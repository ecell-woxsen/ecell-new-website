import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Public mutation for visitors to submit inquiry messages through the contact wall.
 * Includes input validation, spam deduplication, and notification dispatch to leadership.
 */
export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const message = args.message.trim();

    // 1. Input Validation
    if (!name || name.length < 2) {
      throw new Error("Please enter your name (at least 2 characters).");
    }
    if (name.length > 100) {
      throw new Error("Name cannot exceed 100 characters.");
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (email.length > 150) {
      throw new Error("Email address is too long.");
    }
    if (!message || message.length < 5) {
      throw new Error("Please write a message with at least 5 characters.");
    }
    if (message.length > 3000) {
      throw new Error("Message cannot exceed 3,000 characters.");
    }

    // 2. Anti-spam & rate-limiting defense
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    const recentSubmissions = await ctx.db
      .query("contacts")
      .withIndex("by_created_at", (q) => q.gte("createdAt", oneMinuteAgo))
      .filter((q) => q.eq(q.field("email"), email))
      .collect();

    if (recentSubmissions.length >= 3) {
      throw new Error(
        "You are submitting too frequently. Please wait a minute before sending another message."
      );
    }

    // Deduplicate identical submissions sent within 60 seconds
    const duplicate = recentSubmissions.find((s) => s.message === message);
    if (duplicate) {
      return { success: true, contactId: duplicate._id };
    }

    // 3. Insert contact record
    const contactId = await ctx.db.insert("contacts", {
      name,
      email,
      message,
      status: "unread",
      source: args.source ?? "website_contact_wall",
      createdAt: now,
    });

    // 4. Notify leadership/admins in ecell_report in real-time
    try {
      const approvedUsers = await ctx.db
        .query("users")
        .withIndex("by_approved", (q) => q.eq("approved", true))
        .collect();

      const leadershipUsers = approvedUsers.filter((u) =>
        u.roles.some((r) =>
          ["admin", "president", "vice_president", "core_team"].includes(r)
        )
      );

      const snippet =
        message.length > 55 ? message.slice(0, 52) + "..." : message;

      for (const leader of leadershipUsers) {
        if (leader.clerkId) {
          await ctx.db.insert("notifications", {
            recipientClerkId: leader.clerkId,
            type: "contact_inquiry",
            message: `New Inquiry from ${name} (${email}): "${snippet}"`,
            read: false,
            createdAt: now,
          });
        }
      }
    } catch {
      // Non-blocking: ensure contact submission succeeds even if notification insert fails
    }

    return { success: true, contactId };
  },
});

/**
 * Query submissions for the admin / report dashboard view.
 * Supports filtering by status and optional limit.
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("unread"),
        v.literal("read"),
        v.literal("replied"),
        v.literal("archived")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.status) {
      return await ctx.db
        .query("contacts")
        .withIndex("by_status_created_at", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("contacts")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

/**
 * Fetch a single contact submission by ID.
 */
export const getById = query({
  args: {
    id: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Update the status of a contact submission (e.g. read, replied, archived).
 */
export const updateStatus = mutation({
  args: {
    id: v.id("contacts"),
    status: v.union(
      v.literal("unread"),
      v.literal("read"),
      v.literal("replied"),
      v.literal("archived")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
    return { success: true };
  },
});

/**
 * Delete a contact submission if needed.
 */
export const deleteContact = mutation({
  args: {
    id: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Summary counts for badge indicators and overview metrics.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("contacts").collect();
    const unread = all.filter((c) => c.status === "unread").length;
    const replied = all.filter((c) => c.status === "replied").length;
    return {
      total: all.length,
      unread,
      replied,
    };
  },
});
