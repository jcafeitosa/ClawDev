import { DropdownMenu as Primitive } from "bits-ui";

export { default as DropdownMenuContent } from "./dropdown-menu-content.svelte";
export { default as DropdownMenuItem } from "./dropdown-menu-item.svelte";
export { default as DropdownMenuLabel } from "./dropdown-menu-label.svelte";
export { default as DropdownMenuSeparator } from "./dropdown-menu-separator.svelte";
export { default as DropdownMenuShortcut } from "./dropdown-menu-shortcut.svelte";
export { default as DropdownMenuSubContent } from "./dropdown-menu-sub-content.svelte";
export { default as DropdownMenuSubTrigger } from "./dropdown-menu-sub-trigger.svelte";
export { default as DropdownMenuCheckboxItem } from "./dropdown-menu-checkbox-item.svelte";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuSub = Primitive.Sub;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;
