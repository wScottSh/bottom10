import Image from "next/image";
import TypingTest from './components/TypingTest';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#232323] text-[#e2e2e2] flex flex-col items-center justify-center p-8">
      <main className="w-full max-w-3xl">
        <TypingTest />
      </main>
    </div>
  );
}
