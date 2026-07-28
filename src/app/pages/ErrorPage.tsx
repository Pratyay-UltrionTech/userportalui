import { useRouteError, useNavigate } from 'react-router';
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';

export function ErrorPage() {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  console.error('Route error:', error);

  const errorMessage = error?.statusText || error?.message || 'An unexpected error occurred';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center"
      >
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          {errorMessage}
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 bg-[#4F46E5] text-white py-4 rounded-xl font-bold hover:bg-[#4338CA] transition-all shadow-lg shadow-indigo-100"
          >
            <RotateCcw className="w-5 h-5" />
            Try Refreshing
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 border-2 border-gray-100 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-50">
          <p className="text-xs text-gray-400">
            If the problem persists, please contact support with the error details.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
