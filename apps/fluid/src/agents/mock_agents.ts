export async function generateMockResponse(_input: string, type: 'logic' | 'ui'): Promise<any> {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (type === 'logic') {
        return {
            summary: "Market is mixed today.",
            data: {
                sp500: 5432.10,
                nasdaq: 17654.32,
                change: "+0.45%",
                topStock: "NVDA"
            },
            recommendation: "Hold"
        };
    }

    if (type === 'ui') {
        return {
            code: `
  const App = ({ data }) => {
    // data is passed as a string/object, safe to parse if needed, but here it's already an object in context
    const stats = data; 
  
    return (
      <div className="p-8 bg-slate-900 min-h-screen text-white">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="flex justify-between items-center bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Market Overview</h1>
              <p className="text-slate-400 mt-1">Real-time analysis</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-green-400">{stats.change}</div>
              <div className="text-sm text-slate-500">Today's Trend</div>
            </div>
          </header>
  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm hover:border-blue-500/50 transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-300 font-medium">S&P 500</h3>
                <div className="w-8 h-8 rounded-full bg-slate-700 group-hover:bg-blue-500/20 transition-colors"></div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">{stats.sp500}</div>
              <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full w-[70%] bg-blue-500 rounded-full"></div>
              </div>
            </div>
  
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm hover:border-purple-500/50 transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-300 font-medium">NASDAQ</h3>
                <div className="w-8 h-8 rounded-full bg-slate-700 group-hover:bg-purple-500/20 transition-colors"></div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">{stats.nasdaq}</div>
              <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full w-[60%] bg-purple-500 rounded-full"></div>
              </div>
            </div>
          </div>
  
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm flex items-center gap-2">
            <span className="font-bold">AI Insight:</span> {stats.topStock} is leading the rally.
          </div>
        </div>
      </div>
    );
  };
  `
        };
    }
}
