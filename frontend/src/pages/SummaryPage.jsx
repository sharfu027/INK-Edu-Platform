import React, { useState } from 'react';
import Sidebar from '../components/ui/Sidebar';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import axios from 'axios';

const SummaryPage = () => {
  const [standard, setStandard] = useState('10th');
  const [subject, setSubject] = useState('Science');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');

  const standards = [
    "Nursery", "LKG", "UKG",
    "1st", "2nd", "3rd", "4th", "5th",
    "6th", "7th", "8th", "9th", "10th",
    "PUC 1st Year", "PUC 2nd Year",
    "ITI", "Diploma 1st Year", "Diploma 2nd Year", "Diploma 3rd Year",
    "Degree 1st Year", "Degree 2nd Year", "Degree 3rd Year",
    "Engineering 1st Year", "Engineering 2nd Year",
    "Engineering 3rd Year", "Engineering 4th Year",
    "MBBS", "Law", "MBA", "MA", "MSc",
    "MTech", "MPhil", "PhD"
  ];

  const subjects = [
    "Mathematics", "Physics", "Chemistry", "Biology", "Science",
    "English", "Social Science", "History", "Geography", "Civics",
    "Economics", "Commerce", "Accountancy", "Business Studies",
    "Computer Science", "Coding & Programming", "Data Structures",
    "Algorithms", "Artificial Intelligence", "Machine Learning",
    "Anatomy", "Physiology", "Pharmacology", "Constitutional Law",
    "Criminal Law", "Hindi", "Kannada", "Sanskrit", "Art & Craft",
    "Music", "Physical Education"
  ];

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error('Please enter a topic name');
      return;
    }

    setLoading(true);
    setSummary('');
    const toastId = toast.loading('Generating topic summary from Gemini AI...');

    try {
      const vidyaAiApiUrl = import.meta.env.VITE_VIDYA_AI_API_URL || 'http://localhost:8081';
      const response = await axios.post(`${vidyaAiApiUrl}/api/summary`, {
        standard,
        subject,
        topic: topic.trim()
      });

      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        toast.success('Summary generated successfully!', { id: toastId });
      } else {
        toast.error('Failed to generate summary.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.message || 'Error generating summary.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const parseMarkdown = (md) => {
    if (!md) return '';
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-stone-900 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-extrabold text-stone-900 mt-5 mb-2.5 border-b border-stone-200 pb-1">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-black text-stone-900 mt-6 mb-3">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-stone-900">$1</strong>');

    // Code blocks and inline code
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-stone-100 p-4 rounded-xl font-mono text-xs text-stone-850 my-4 overflow-x-auto border border-stone-200 whitespace-pre-wrap">$1</pre>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-stone-100 px-1.5 py-0.5 rounded font-mono text-xs text-stone-800">$1</code>');

    // Bullet points
    const lines = html.split('\n');
    let inList = false;
    const processedLines = [];

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        if (!inList) {
          processedLines.push('<ul class="list-disc pl-5 space-y-1.5 my-3 text-stone-600">');
          inList = true;
        }
        processedLines.push(`<li>${trimmed.substring(2)}</li>`);
      } else {
        if (inList) {
          processedLines.push('</ul>');
          inList = false;
        }
        processedLines.push(line);
      }
    }
    if (inList) {
      processedLines.push('</ul>');
    }

    html = processedLines.join('\n');

    // Paragraph breaks
    html = html.replace(/\n\n/g, '</p><p class="mt-3.5 text-stone-600 leading-relaxed text-sm">');
    html = `<p class="text-stone-600 leading-relaxed text-sm">${html}</p>`;

    return html;
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied to clipboard!');
  };

  const handlePrint = () => {
    const printContent = document.getElementById('summary-content-box').innerHTML;
    const originalContent = document.body.innerHTML;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Topic Summary - ${topic}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; color: #1c1917; }
            h1 { font-size: 1.5rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 0.75rem; }
            h2 { font-size: 1.25rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; border-bottom: 1px solid #e7e5e4; padding-bottom: 0.25rem; }
            h3 { font-size: 1.125rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; }
            p { margin-top: 0.75rem; font-size: 0.875rem; line-height: 1.6; color: #44403c; }
            ul { list-style-type: disc; padding-left: 1.25rem; margin-top: 0.75rem; margin-bottom: 0.75rem; }
            li { margin-top: 0.25rem; font-size: 0.875rem; color: #44403c; }
            pre { background-color: #f5f5f4; padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.75rem; overflow-x: auto; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="max-w-3xl mx-auto">
            <div class="border-b-2 border-stone-200 pb-4 mb-6">
              <h2 class="text-sm font-bold uppercase tracking-wider text-amber-600">INK Edu Platform - Academic Topic Summary</h2>
              <div class="grid grid-cols-3 gap-4 mt-2 text-xs text-stone-500">
                <div><strong>Standard:</strong> ${standard}</div>
                <div><strong>Subject:</strong> ${subject}</div>
                <div><strong>Topic:</strong> ${topic}</div>
              </div>
            </div>
            <div>${printContent}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex bg-stone-50 min-h-[calc(100vh-4rem)]">
      <Sidebar />
      <div className="flex-1 bg-[#F8F9FA] p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Header Banner */}
          <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">
                Teacher Section
              </div>
              <h1 className="text-2xl font-black text-stone-900">
                AI Topic Summary Generator
              </h1>
              <p className="text-stone-500 text-sm mt-0.5">
                Generate student-friendly lecture notes and summaries instantly using Gemini AI
              </p>
            </div>
            <div className="text-4xl">📖</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Input Form Column */}
            <div className="md:col-span-1 bg-white border border-stone-200 shadow-sm rounded-2xl p-5 h-fit">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-stone-400 mb-4">
                Summary Parameters
              </h2>
              
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    Standard
                  </label>
                  <select
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-850 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-medium"
                  >
                    {standards.map((std) => (
                      <option key={std} value={std}>{std}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    Subject Name
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-850 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-medium"
                  >
                    {subjects.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    Topic Name
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Photosynthesis, Trigonometry"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-850 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-stone-900 rounded-xl text-sm font-bold shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Generate Summary</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Output Summary Column */}
            <div className="md:col-span-2 bg-white border border-stone-200 shadow-sm rounded-2xl p-6 flex flex-col min-h-[400px]">
              
              {/* Output Header */}
              <div className="flex items-center justify-between border-b border-stone-150 pb-4 mb-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-stone-400">
                  AI Generated Summary
                </h2>
                {summary && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                      title="Copy to Clipboard"
                    >
                      <span>📋</span> Copy
                    </button>
                    <button
                      onClick={handlePrint}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                      title="Save as PDF or Print"
                    >
                      <span>🖨️</span> PDF / Print
                    </button>
                  </div>
                )}
              </div>

              {/* Output Content */}
              <div className="flex-1 flex flex-col justify-center">
                {loading ? (
                  <div className="text-center py-12">
                    <Spinner size="lg" className="mx-auto mb-4" />
                    <p className="text-stone-550 font-medium text-sm">Consulting Gemini AI knowledge base...</p>
                    <p className="text-stone-405 text-xs mt-1">This may take up to 15 seconds depending on content size.</p>
                  </div>
                ) : summary ? (
                  <div
                    id="summary-content-box"
                    className="prose max-w-none text-stone-800"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(summary) }}
                  />
                ) : (
                  <div className="text-center py-16 text-stone-400">
                    <div className="text-5xl mb-4">✍️</div>
                    <p className="text-sm font-semibold">Ready to generate</p>
                    <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                      Fill out the parameters on the left and click generate to get an structured topic summary.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
