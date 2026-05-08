import { clearTestDB, connectTestDB, disconnectTestDB } from "@/db";
import { afterAll, afterEach, beforeAll } from "vitest";

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});
