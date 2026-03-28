import { Select as Primitive } from "bits-ui";

export { default as SelectContent } from "./select-content.svelte";
export { default as SelectItem } from "./select-item.svelte";
export { default as SelectTrigger } from "./select-trigger.svelte";
export { default as SelectLabel } from "./select-label.svelte";
export { default as SelectSeparator } from "./select-separator.svelte";

export const Select = Primitive.Root;
export const SelectGroup = Primitive.Group;
