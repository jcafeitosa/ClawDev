import { j as attr, e as escape_html, i as ensure_array_like } from "../../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import "../../../../../chunks/company.svelte.js";
import "../../../../../chunks/client.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let title = "";
    let description = "";
    let status = "todo";
    let priority = "medium";
    let agents = [];
    let assigneeAgentId = "";
    let projects = [];
    let projectId = "";
    const statuses = [
      { value: "backlog", label: "Backlog" },
      { value: "todo", label: "To Do" },
      { value: "in_progress", label: "In Progress" },
      { value: "in_review", label: "In Review" },
      { value: "done", label: "Done" },
      { value: "blocked", label: "Blocked" }
    ];
    const priorities = [
      { value: "urgent", label: "Urgent" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" }
    ];
    $$renderer2.push(`<div class="mx-auto max-w-2xl p-6 space-y-6"><h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Create Issue</h1> <form class="space-y-4"><label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Title *</span> <input${attr("value", title)} required="" placeholder="Issue title" class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"/></label> <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</span> <textarea${attr("rows", 4)} placeholder="Describe the issue..." class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">`);
    const $$body = escape_html(description);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></label> <div class="grid grid-cols-2 gap-4"><label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</span> `);
    $$renderer2.select(
      {
        value: status,
        class: "mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 capitalize"
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(statuses);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let s = each_array[$$index];
          $$renderer3.option({ value: s.value }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(s.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</label> <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Priority</span> `);
    $$renderer2.select(
      {
        value: priority,
        class: "mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 capitalize"
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(priorities);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let p = each_array_1[$$index_1];
          $$renderer3.option({ value: p.value }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(p.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</label></div> <div class="grid grid-cols-2 gap-4"><label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Assignee Agent</span> `);
    $$renderer2.select(
      {
        value: assigneeAgentId,
        class: "mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Unassigned`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_2 = ensure_array_like(agents);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let a = each_array_2[$$index_2];
          $$renderer3.option({ value: a.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(a.name)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</label> <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Project</span> `);
    $$renderer2.select(
      {
        value: projectId,
        class: "mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`No project`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_3 = ensure_array_like(projects);
        for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
          let p = each_array_3[$$index_3];
          $$renderer3.option({ value: p.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(p.name)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</label></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button type="submit"${attr("disabled", !title.trim(), true)} class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">${escape_html("Create Issue")}</button></form></div>`);
  });
}
export {
  _page as default
};
