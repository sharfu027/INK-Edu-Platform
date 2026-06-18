import React from 'react';
import Sidebar from '../components/ui/Sidebar';

const VidyaAiPage = () => {
  return (
    <div className="flex bg-stone-50 min-h-[calc(100vh-4rem)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FA] relative">
        <div className="w-full h-[calc(100vh-4rem)] relative overflow-hidden">
          <iframe
            src="http://localhost:3001"
            title="INK Education AI Assistant"
            className="absolute top-0 left-0 w-full h-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; camera"
          />
        </div>
      </div>
    </div>
  );
};

export default VidyaAiPage;
