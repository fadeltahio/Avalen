// The client side of the app, re-exported from one file so existing imports of
// "./client.jsx" keep working. Each screen's own code lives in
// src/avalen/client/*.jsx — start there for any specific screen.
export { Today } from "./client/Today.jsx";
export { Plan, ExerciseThumbnail } from "./client/Plan.jsx";
export { Nutrition, FoodLogger } from "./client/Nutrition.jsx";
export { Habits } from "./client/Habits.jsx";
export { Progress, Consistency, Photos, InBodyPanel } from "./client/Progress.jsx";
