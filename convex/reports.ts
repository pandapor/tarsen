import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listPackageReports = query({ args:{ organizationId:v.optional(v.id("organizations")) }, handler:async(ctx,args)=>args.organizationId?ctx.db.query("packageReports").filter(q=>q.eq(q.field("organizationId"),args.organizationId)).collect():[] });
export const savePackageReport = mutation({ args:{ organizationId:v.optional(v.id("organizations")), package:v.string(), version:v.string(), risk:v.string(), recommendation:v.string(), signals:v.array(v.object({type:v.string(),severity:v.string(),message:v.string(),file:v.optional(v.string())})) }, handler:async(ctx,args)=>ctx.db.insert("packageReports",args) });
