import type { NukemAICustomRouter } from "../../router/customRouter/customRouter.js";

export type RouterContribution = {
  id: string;
  description?: string;
  createCustomRouter(): NukemAICustomRouter;
};
