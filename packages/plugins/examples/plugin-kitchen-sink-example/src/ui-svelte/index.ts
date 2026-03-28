/**
 * Kitchen Sink plugin — Svelte 5 UI entry point.
 *
 * Re-exports all Svelte components for the plugin manifest to reference.
 * Each component is a separate .svelte file (modular, vs the 2400-line React monolith).
 */

export { default as KitchenSinkPage } from "./Page.svelte";
export { default as KitchenSinkDashboardWidget } from "./DashboardWidget.svelte";
export { default as KitchenSinkSidebarLink } from "./SidebarLink.svelte";
export { default as KitchenSinkIssueTab } from "./IssueTab.svelte";
export { default as KitchenSinkCommentAnnotation } from "./CommentAnnotation.svelte";
export { default as KitchenSinkSettingsPage } from "./SettingsPage.svelte";
