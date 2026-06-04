// Approvals = алиас задач с фильтром по типу APPROVAL
import { createFileRoute } from "@tanstack/react-router";
import { Route as TasksRoute } from "./tasks";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: TasksRoute.options.component,
});
