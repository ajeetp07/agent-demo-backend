import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import "./mocks/database.mock";
import "./mocks/authkit-provider.mock";
import "./mocks/email-service.mock";
