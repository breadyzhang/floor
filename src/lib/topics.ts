import { promises as fs } from "fs";
import path from "path";
import type { TopicSelection } from "../state/roundStore";

const toDisplayName = (filename: string) => {
  const withoutExtension = filename.replace(/\.pdf$/i, "");
  return withoutExtension
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const publicDir = path.join(process.cwd(), "public");

const getTopicsForFolder = async (folder: string): Promise<TopicSelection[]> => {
  const topicsDir = path.join(publicDir, folder);
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
            answerPath = `/${folder}/${answerFilename}`;
          } catch {
            answerPath = undefined;
          }
          return {
            id: `${folder}/${entry.name.toLowerCase()}`,
            name: toDisplayName(entry.name),
            folder,
            filePath: `/${folder}/${entry.name}`,
            answerPath,
          } satisfies TopicSelection;
        })
    );

    return topics.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
};

export interface TopicFolder {
  folder: string;
  topics: TopicSelection[];
}

export const getTopicFolders = async (): Promise<TopicFolder[]> => {
  try {
    const entries = await fs.readdir(publicDir, { withFileTypes: true });
    const folderNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const folders = await Promise.all(
      folderNames.map(async (folder) => ({
        folder,
        topics: await getTopicsForFolder(folder),
      }))
    );

    return folders.sort((a, b) => {
      if (a.folder === "topics") return -1;
      if (b.folder === "topics") return 1;
      return a.folder.localeCompare(b.folder);
    });
  } catch {
    return [];
  }
};

export const getAvailableTopics = async (
  folder = "topics"
): Promise<TopicSelection[]> => getTopicsForFolder(folder);
