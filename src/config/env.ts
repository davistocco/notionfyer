import { cleanEnv, str } from 'envalid';

const env = cleanEnv(process.env, {
  NOTION_TOKEN: str(),
  NOTION_SPENDINGS_DB: str(),
  NOTION_BUDGET_LIMIT_DB: str(),
  SNS_TOPIC_ARN: str()
});

export type Env = typeof env;

export default env;
