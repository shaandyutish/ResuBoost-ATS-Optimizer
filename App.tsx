
import React, { useState, useRef } from 'react';
import { analyzeResume } from './services/geminiService';
import { AnalysisResult, AppStatus, AuditMetric } from './types';
import ScoreGauge from './components/ScoreGauge';

declare const mammoth: any;
declare const pdfjsLib: any;

const AuditCard = ({ title, icon, metric }: { title: string, icon: string, metric: AuditMetric }) => {
  const colorMap = {
    pass: 'text-emerald-700 bg-emerald-50 border-emerald-400',
    warning: 'text-amber-700 bg-amber-50 border-amber-400',
    fail: 'text-rose-700 bg-rose-50 border-rose-400'
  };

  const statusLabel = {
    pass: 'PASSED',
    warning: 'FIX RECOMMENDED',
    fail: 'CRITICAL ISSUE'
  };

  return (
    <div className={`p-5 rounded-3xl border-2 ${colorMap[metric.status]} bg-white transition-all hover:shadow-xl relative overflow-hidden h-full`}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${metric.status === 'pass' ? 'bg-emerald-500' : metric.status === 'fail' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
      <div className="flex items-center justify-between mb-4 pl-2">
        <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <i className={`fas ${icon}`}></i> {title}
        </h4>
        <span className={`text-[8px] font-black px-2 py-1 rounded border ${metric.status === 'pass' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : metric.status === 'fail' ? 'bg-rose-100 border-rose-200 text-rose-700' : 'bg-amber-100 border-amber-200 text-amber-700'}`}>
          {statusLabel[metric.status]}
        </span>
      </div>
      <div className="pl-2 space-y-4">
        <p className="text-sm font-bold text-slate-800">{metric.message}</p>
        {metric.details && metric.details.length > 0 && (
          <div className="space-y-3">
            {metric.details.map((detail, idx) => {
              const [word, why, fix, alternative] = detail.split(' | ');
              return (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded">ITEM</span>
                    <span className="font-mono font-bold text-slate-900 text-sm italic">"{word}"</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-600"><span className="font-bold text-slate-900">Why:</span> {why}</p>
                    <div className="flex flex-col sm:flex-row sm:gap-4 gap-2">
                      <div className="flex-1 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                        <p className="text-emerald-700 font-bold"><i className="fas fa-check-circle mr-1"></i> Replace With:</p>
                        <p className="text-emerald-900 font-medium">{fix}</p>
                      </div>
                      <div className="flex-1 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                        <p className="text-indigo-700 font-bold"><i className="fas fa-lightbulb mr-1"></i> Other Ways:</p>
                        <p className="text-indigo-900 font-medium">{alternative}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to sanitize extracted text and remove common parsing artifacts
  const sanitizeText = (text: string): string => {
    return text
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Remove non-printable characters
      .replace(/[ \t]{2,}/g, ' ') // Collapse multiple spaces/tabs to one
      .replace(/\n{3,}/g, '\n\n') // Normalize excessive line breaks
      .trim();
  };

  const parsePDF = async (data: ArrayBuffer): Promise<string> => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Improved joining logic to prevent merged words
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return sanitizeText(fullText);
  };

  const parseDocx = async (data: ArrayBuffer): Promise<string> => {
    const res = await mammoth.extractRawText({ arrayBuffer: data });
    return sanitizeText(res.value);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setStatus(AppStatus.LOADING);
    try {
      const arrayBuffer = await file.arrayBuffer();
      let extractedText = '';
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        extractedText = await parsePDF(arrayBuffer);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        extractedText = await parseDocx(arrayBuffer);
      } else {
        throw new Error('Unsupported format.');
      }
      setResumeText(extractedText);
      setStatus(AppStatus.IDLE);
    } catch (err: any) {
      setError(err.message);
      setStatus(AppStatus.ERROR);
      setFileName(null);
    }
  };

  const handleAnalyze = async () => {
    if (!resumeText.trim() || !jobDescription.trim()) {
      setError('Please provide both resume and job description.');
      return;
    }
    setStatus(AppStatus.LOADING);
    setError(null);
    try {
      const data = await analyzeResume(resumeText, jobDescription);
      setResult(data);
      setStatus(AppStatus.SUCCESS);
      setTimeout(() => {
        document.getElementById('results-view')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError('Analysis failed. Check API key and try again.');
      setStatus(AppStatus.ERROR);
    }
  };

  const reset = () => {
    setResult(null);
    setStatus(AppStatus.IDLE);
    setResumeText('');
    setJobDescription('');
    setFileName(null);
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans selection:bg-indigo-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={reset}>
            <div className="bg-indigo-600 p-2 rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-indigo-100">
              <i className="fas fa-bolt text-white"></i>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">
              ATS <span className="text-indigo-600">Pro</span> <span className="text-[15px] text-slate-700">V4.6</span>
            </h1>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Powered by gemini 3 flash
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <i className="fas fa-cloud-upload-alt text-indigo-500"></i> Resume Box
              </h3>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${fileName ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-400'}`}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx" onChange={handleFileUpload} />
                <i className={`fas ${fileName ? 'fa-file-circle-check text-indigo-500' : 'fa-file-import text-slate-200'} text-4xl mb-3`}></i>
                <p className="text-sm font-black text-slate-700 truncate">{fileName || 'Drop Resume Here'}</p>
                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Supports PDF & DOCX</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <i className="fas fa-bullseye text-indigo-500"></i> Job Description
              </h3>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job requirements here..."
                className="w-full h-56 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-sm outline-none resize-none bg-white placeholder:text-slate-300"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={status === AppStatus.LOADING || !resumeText || !jobDescription}
              className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all disabled:bg-slate-300 disabled:shadow-none disabled:translate-y-0"
            >
              {status === AppStatus.LOADING ? <i className="fas fa-cog fa-spin mr-2"></i> : 'Run test'}
            </button>
            {error && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase text-center tracking-widest">{error}</div>}
          </div>

          <div className="lg:col-span-2 space-y-8">
            {!result && status === AppStatus.IDLE && (
              <div className="flex flex-col items-center justify-center text-center p-16 bg-white rounded-[3rem] border-2 border-slate-100 border-dashed min-h-[500px]">
                <div className="w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center mb-8 animate-pulse">
                  <i className="fas fa-radar text-5xl text-indigo-200"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Waiting....</h3>
                <p className="text-slate-400 text-sm max-w-sm mt-4 font-medium italic">Upload your documentation to begin a high-precision ATS compatibility scan.</p>
              </div>
            )}

            {result && status === AppStatus.SUCCESS && (
              <div id="results-view" className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-8">
                    <ScoreGauge score={result.score} label="Role Alignment" />
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Match Rating</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Contextual Score</p>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-8">
                    <ScoreGauge score={result.formattingScore} label="ATS Readability" />
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter">System Health</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Parsing Fidelity</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                  <div className="mb-10">
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Technical Diagnostics</h3>
                    <p className="text-slate-400 text-sm font-medium mt-1">Deep analysis of grammatical, repeated, and structural failures.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <AuditCard title="Typography Audit" icon="fa-font" metric={result.audit.typography} />
                    <AuditCard title="Grammar & Logic" icon="fa-spell-check" metric={result.audit.grammarSpelling} />
                    <AuditCard title="Redundancy Scan" icon="fa-redo" metric={result.audit.repetition} />
                    <AuditCard title="Layout Integrity" icon="fa-th-large" metric={result.audit.layoutComplexity} />
                    <AuditCard title="Section Archetypes" icon="fa-heading" metric={result.audit.sectionHeadings} />
                  </div>
                </div>

                <div className="bg-slate-900 p-12 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-48 -mt-48"></div>
                  <h3 className="text-xl font-black uppercase tracking-[0.3em] text-indigo-400 mb-10 flex items-center gap-4">
                    <i className="fas fa-layer-group"></i> Semantic Keyword Delta
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Found & Validated</p>
                      <div className="flex flex-wrap gap-2">
                        {result.matchedKeywords.map((kw, i) => (
                          <span key={i} className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">High-Priority Gaps</p>
                      <div className="flex flex-wrap gap-2">
                        {result.missingKeywords.map((kw, i) => (
                          <span key={i} className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] font-black text-rose-400 uppercase tracking-wider">
                            + {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
