import { promises as fs } from "fs";
import path from "path";
import type { TopicSelection } from "../state/roundStore";

const toDisplayName = (filename: string) => {
  const withoutExtension = filename.replace(/\.pdf$/i, "");
  return withoutExtension
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getAvailableTopics = async (): Promise<TopicSelection[]> => {
  const topicsDir = path.join(process.cwd(), "public", "topics");
  try {
    const entries = await fs.readdir(topicsDir, { withFileTypes: true });
    const topics = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")
        )
        .map(async (entry) => {
          const baseName = entry.name.replace(/\.pdf$/i, "");
          const answerFilename = `${baseName}.json`;
          const candidatePath = path.join(topicsDir, answerFilename);
          let answerPath: string | undefined;
          try {
            await fs.access(candidatePath);
            answerPath = `/topics/${answerFilename}`;
          } catch {
            answerPath = undefined;
          }
          return {
            id: entry.name.toLowerCase(),
            name: toDisplayName(entry.name),
            filePath: `/topics/${entry.name}`,
            answerPath,
          } satisfies TopicSelection;
        })
    );

    return topics.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
};
