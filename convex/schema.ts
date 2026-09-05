import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── USERS ──────────────────────────────────────────────────────────
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    yearOfStudy: v.optional(v.string()),
    roles: v.array(
      v.union(
        v.literal("member"),
        v.literal("department_head"),
        v.literal("team_lead"),
        v.literal("core_team"),
        v.literal("president"),
        v.literal("vice_president"),
        v.literal("advisor"),
        v.literal("admin")
      )
    ),
    requestedRoles: v.optional(
      v.array(
        v.union(
          v.literal("member"),
          v.literal("department_head"),
          v.literal("team_lead"),
          v.literal("core_team"),
          v.literal("president"),
          v.literal("vice_president"),
          v.literal("advisor"),
          v.literal("admin")
        )
      )
    ),
    roleRequestCreatedAt: v.optional(v.number()),
    departmentId: v.optional(v.id("departments")),
    avatarUrl: v.optional(v.string()),
    approved: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_department", ["departmentId"])
    .index("by_approved", ["approved"]),

  // ── DEPARTMENTS ────────────────────────────────────────────────────
  departments: defineTable({
    name: v.string(),
    slug: v.string(),
    colorTag: v.string(),
    description: v.optional(v.string()),
    headUserId: v.optional(v.id("users")),
    templateId: v.optional(v.id("templates")),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  // ── TEMPLATES ──────────────────────────────────────────────────────
  templates: defineTable({
    name: v.string(),
    departmentId: v.id("departments"),
    sections: v.array(
      v.object({
        key: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        placeholder: v.optional(v.string()),
        type: v.union(
          v.literal("header"),
          v.literal("dynamic_table"),
          v.literal("textarea"),
          v.literal("textarea_multi"),
          v.literal("metrics_grid"),
          v.literal("performance_quadrant"),
          v.literal("budget_table"),
          v.literal("campaign_table")
        ),
        required: v.boolean(),
        enabled: v.boolean(),
        order: v.number(),
        config: v.optional(v.any()),
      })
    ),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_department", ["departmentId"]),

  // ── REPORTS ────────────────────────────────────────────────────────
  reports: defineTable({
    departmentId: v.id("departments"),
    departmentName: v.string(),
    weekLabel: v.string(),
    weekStart: v.string(),
    departmentHeadClerkId: v.string(),
    departmentHeadName: v.string(),
    activeMembersCount: v.optional(v.number()),
    submissionDate: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("submitted")),
    createdAt: v.number(),
    updatedAt: v.number(),
    submittedAt: v.optional(v.number()),
    sections: v.any(),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          contentType: v.optional(v.string()),
          size: v.number(),
          description: v.optional(v.string()),
          uploadedAt: v.number(),
          uploadedByClerkId: v.string(),
          uploadedByName: v.string(),
        })
      )
    ),
  })
    .index("by_department", ["departmentId"])
    .index("by_week_start", ["weekStart"])
    .index("by_status", ["status"])
    .index("by_department_week", ["departmentId", "weekStart"]),

  // ── COMMENTS ───────────────────────────────────────────────────────
  comments: defineTable({
    reportId: v.id("reports"),
    sectionKey: v.string(),
    authorClerkId: v.string(),
    authorName: v.string(),
    text: v.string(),
    tag: v.optional(
      v.union(
        v.literal("Action Required"),
        v.literal("Good Work"),
        v.literal("Follow Up"),
        v.literal("Note")
      )
    ),
    parentId: v.optional(v.id("comments")),
    resolved: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_report", ["reportId"])
    .index("by_report_section", ["reportId", "sectionKey"]),

  // ── NOTIFICATIONS ──────────────────────────────────────────────────
  notifications: defineTable({
    recipientClerkId: v.string(),
    type: v.union(
      v.literal("report_submitted"),
      v.literal("comment_added"),
      v.literal("comment_reply"),
      v.literal("report_overdue"),
      v.literal("account_approved"),
      v.literal("pending_user"),
      v.literal("contact_inquiry")
    ),
    reportId: v.optional(v.id("reports")),
    commentId: v.optional(v.id("comments")),
    departmentName: v.optional(v.string()),
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_recipient", ["recipientClerkId"]),

  // ── ANNOUNCEMENTS ─────────────────────────────────────────────────
  announcements: defineTable({
    authorClerkId: v.string(),
    authorName: v.string(),
    title: v.string(),
    body: v.string(),
    targetRoles: v.array(v.string()),
    targetDepartmentIds: v.optional(v.array(v.id("departments"))),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  }),

  // ── OFFICE LOGBOOK ─────────────────────────────────────────────────
  // Records who was in the office and when they entered.
  // `type` discriminates between registered members and walk-in visitors.
  // `checkedOutAt` is reserved for future exit tracking — not written to yet.
  attendance: defineTable({
    type: v.union(v.literal("member"), v.literal("visitor")),

    // Member-only fields (set when type === "member")
    clerkId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    departmentId: v.optional(v.id("departments")), // denormalized at entry time

    // Visitor-only fields (set when type === "visitor")
    visitorName: v.optional(v.string()),
    visitorCourse: v.optional(v.string()),

    // Common fields
    dateKey: v.string(),        // ISO date string "YYYY-MM-DD" (IST local date)
    checkedInAt: v.number(),    // epoch ms — when they entered the office
    checkedOutAt: v.optional(v.number()), // epoch ms — reserved for future exit tracking
    method: v.literal("qr_scan"), // leave room for future methods (manual override, etc.)
    note: v.optional(v.string()),  // optional admin-added context
  })
    // One check-in per member per day; also used for member history
    .index("by_clerk_date", ["clerkId", "dateKey"])
    // Daily logbook view (members + visitors together)
    .index("by_date", ["dateKey"])
    // Per-department analytics
    .index("by_department_date", ["departmentId", "dateKey"]),

  // ── CONTACT FORM SUBMISSIONS (MAIN WEBSITE) ────────────────────────
  contacts: defineTable({
    name: v.string(),
    email: v.string(),
    message: v.string(),
    status: v.union(
      v.literal("unread"),
      v.literal("read"),
      v.literal("replied"),
      v.literal("archived")
    ),
    source: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"])
    .index("by_status_created_at", ["status", "createdAt"]),
});
