/** Dialog store — manage modal/dialog open states */

export interface NewIssueDefaults {
  status?: string;
  priority?: string;
  projectId?: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  title?: string;
  description?: string;
}

export interface NewGoalDefaults {
  title?: string;
}

export interface OnboardingOptions {
  step?: string;
}

let newIssueOpen = $state(false);
let newIssueDefaults = $state<NewIssueDefaults>({});
let newProjectOpen = $state(false);
let newGoalOpen = $state(false);
let newGoalDefaults = $state<NewGoalDefaults>({});
let newAgentOpen = $state(false);
let onboardingOpen = $state(false);
let onboardingOptions = $state<OnboardingOptions>({});

export const dialogStore = {
  // New Issue
  get newIssueOpen() {
    return newIssueOpen;
  },
  get newIssueDefaults() {
    return newIssueDefaults;
  },
  openNewIssue(defaults?: NewIssueDefaults) {
    newIssueDefaults = defaults ?? {};
    newIssueOpen = true;
  },
  closeNewIssue() {
    newIssueOpen = false;
    newIssueDefaults = {};
  },

  // New Project
  get newProjectOpen() {
    return newProjectOpen;
  },
  openNewProject() {
    newProjectOpen = true;
  },
  closeNewProject() {
    newProjectOpen = false;
  },

  // New Goal
  get newGoalOpen() {
    return newGoalOpen;
  },
  get newGoalDefaults() {
    return newGoalDefaults;
  },
  openNewGoal(defaults?: NewGoalDefaults) {
    newGoalDefaults = defaults ?? {};
    newGoalOpen = true;
  },
  closeNewGoal() {
    newGoalOpen = false;
    newGoalDefaults = {};
  },

  // New Agent
  get newAgentOpen() {
    return newAgentOpen;
  },
  openNewAgent() {
    newAgentOpen = true;
  },
  closeNewAgent() {
    newAgentOpen = false;
  },

  // Onboarding
  get onboardingOpen() {
    return onboardingOpen;
  },
  get onboardingOptions() {
    return onboardingOptions;
  },
  openOnboarding(options?: OnboardingOptions) {
    onboardingOptions = options ?? {};
    onboardingOpen = true;
  },
  closeOnboarding() {
    onboardingOpen = false;
    onboardingOptions = {};
  },
};
