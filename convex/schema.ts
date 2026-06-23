import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({ name:v.string(), slug:v.string(), createdBy:v.string() }).index("by_slug",["slug"]),
  policies: defineTable({ organizationId:v.id("organizations"), block:v.array(v.string()), requireConfirmation:v.array(v.string()), allowPackages:v.array(v.string()), blockPackages:v.array(v.string()), defaultDecision:v.union(v.literal("allow"),v.literal("warn"),v.literal("block")) }).index("by_org",["organizationId"]),
  packageReports: defineTable({ organizationId:v.optional(v.id("organizations")), package:v.string(), version:v.string(), risk:v.string(), recommendation:v.string(), signals:v.array(v.object({type:v.string(),severity:v.string(),message:v.string(),file:v.optional(v.string())})) }).index("by_package",["package"]),
  auditEvents: defineTable({ organizationId:v.id("organizations"), action:v.string(), package:v.optional(v.string()), decision:v.string(), actor:v.string() }).index("by_org",["organizationId"]),
  apiKeys: defineTable({ organizationId:v.id("organizations"), name:v.string(), keyHash:v.string(), revokedAt:v.optional(v.number()) }).index("by_org",["organizationId"])
});
