import { SetupRoundForm } from "@/components/SetupRoundForm";
import { getTopicFolders } from "@/lib/topics";

export default async function Home() {
  const topicFolders = await getTopicFolders();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-blue-50 px-6 py-16 font-sans">
      <SetupRoundForm topicFolders={topicFolders} />
    </main>
  );
}
