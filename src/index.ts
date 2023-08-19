import { Client as NotionClient } from '@notionhq/client';
import { PublishCommandInput, SNS } from '@aws-sdk/client-sns';
import 'dotenv/config';
import env from './config/env';

const notion = new NotionClient({ auth: env.NOTION_TOKEN });

export const handler = async () => {
  try {
    const limits = await fetchLimits();
    const spendingsPerCategory = await fetchSpendingsPerCategory();
    const message = prepareBudgetMessage(spendingsPerCategory, limits);
    const sns = new SNS();
    const topicArn = env.SNS_TOPIC_ARN;
    const params: PublishCommandInput = {
      TopicArn: topicArn,
      Subject: 'Notionfyer - Alerta de Gastos',
      Message: message
    };
    await sns.publish(params);
  } catch (err) {
    console.error(err);
  }
};

const prepareBudgetMessage = (
  spendingsPerCategory: Record<string, number>,
  limits: Array<{ category: string, limit: number }>
) => {
  return `
  Estou passando para te avisar que você gastou:\n
${prepareBudgetMessageCategories(spendingsPerCategory, limits)}\n
Até mais!
  `.trim();
};

const prepareBudgetMessageCategories = (
  spendingsPerCategory: Record<string, number>,
  limits: Array<{ category: string, limit: number }>
) => {
  return Object
    .entries(spendingsPerCategory)
    .map(([category, value]) => prepareBudgetMessageItemWithLimit(
      category,
      value,
      limits.find((limit) => limit.category === category)?.limit ?? 0
    ))
    .join('\n');
};

const prepareBudgetMessageItemWithLimit = (
  category: string,
  value: number,
  limit: number
) => {
  const formattedValue = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedLimit = limit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedPercentage = `${(value / limit * 100).toFixed()}%`;
  return `${category}: ${formattedValue} | ${formattedPercentage} do limite(${formattedLimit})`;
};

const fetchSpendingsPerCategory = async () => {
  const spendings = await fetchSpendings();
  const spendingsPerCategory = spendings.reduce<Record<string, number>>((acc, spending) => {
    const { category, value } = spending;
    if (acc[category]) {
      acc[category] += value;
    } else {
      acc[category] = value;
    }
    return acc;
  }, {});
  return spendingsPerCategory;
};

const fetchSpendings = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDateStr = startOfMonth.toISOString().split('T')[0];
  const endDateStr = endOfMonth.toISOString().split('T')[0];

  const { results } = await notion.databases.query({
    database_id: env.NOTION_SPENDINGS_DB,
    filter: {
      and: [
        {
          property: 'Data',
          date: {
            on_or_after: startDateStr
          }
        },
        {
          property: 'Data',
          date: {
            on_or_before: endDateStr
          }
        }
      ]
    },
    sorts: [
      {
        property: 'Categoria',
        direction: 'ascending'
      }
    ]
  });
  return results.map((result) => {
    const { properties } = result as unknown as any;
    return {
      category: properties.Categoria.select.name,
      value: properties.Valor.number
    };
  });
};

const fetchLimits = async () => {
  const { results } = await notion.databases.query({
    database_id: env.NOTION_BUDGET_LIMIT_DB
  });
  return results.map((result) => {
    const { properties } = result as unknown as any;
    return {
      category: properties.Categoria.title[0].plain_text,
      limit: properties.Limite.number
    };
  });
};
