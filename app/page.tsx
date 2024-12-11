import Image from "next/image";
import TypingTest from './components/TypingTest';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#232323] text-[#e2e2e2] flex">
      <main className="flex-1">
        <TypingTest />
      </main>
    </div>
  );
}
