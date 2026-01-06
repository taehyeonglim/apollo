import dynamic from 'next/dynamic';

const CreateContent = dynamic(() => import('@/components/CreateContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function CreatePage() {
  return <CreateContent />;
}
