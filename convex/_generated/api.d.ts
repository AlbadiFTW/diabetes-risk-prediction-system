/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as accountManagement from "../accountManagement.js";
import type * as accountManagementHelpers from "../accountManagementHelpers.js";
import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as authConfig from "../authConfig.js";
import type * as complicationRisk from "../complicationRisk.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as drugInteractions from "../drugInteractions.js";
import type * as educationResources from "../educationResources.js";
import type * as emailVerification from "../emailVerification.js";
import type * as emails from "../emails.js";
import type * as fileStorage from "../fileStorage.js";
import type * as http from "../http.js";
import type * as medicalRecords from "../medicalRecords.js";
import type * as medicationReminders from "../medicationReminders.js";
import type * as medications from "../medications.js";
import type * as messages from "../messages.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwordResetHelpers from "../passwordResetHelpers.js";
import type * as patientAssignments from "../patientAssignments.js";
import type * as predictions from "../predictions.js";
import type * as reminders from "../reminders.js";
import type * as reports from "../reports.js";
import type * as router from "../router.js";
import type * as support from "../support.js";
import type * as twoFactorAuth from "../twoFactorAuth.js";
import type * as twoFactorAuthActions from "../twoFactorAuthActions.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  accountManagement: typeof accountManagement;
  accountManagementHelpers: typeof accountManagementHelpers;
  admin: typeof admin;
  analytics: typeof analytics;
  auth: typeof auth;
  authConfig: typeof authConfig;
  complicationRisk: typeof complicationRisk;
  crons: typeof crons;
  dashboard: typeof dashboard;
  drugInteractions: typeof drugInteractions;
  educationResources: typeof educationResources;
  emailVerification: typeof emailVerification;
  emails: typeof emails;
  fileStorage: typeof fileStorage;
  http: typeof http;
  medicalRecords: typeof medicalRecords;
  medicationReminders: typeof medicationReminders;
  medications: typeof medications;
  messages: typeof messages;
  passwordReset: typeof passwordReset;
  passwordResetHelpers: typeof passwordResetHelpers;
  patientAssignments: typeof patientAssignments;
  predictions: typeof predictions;
  reminders: typeof reminders;
  reports: typeof reports;
  router: typeof router;
  support: typeof support;
  twoFactorAuth: typeof twoFactorAuth;
  twoFactorAuthActions: typeof twoFactorAuthActions;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
