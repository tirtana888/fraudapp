import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { handleBackgroundCheckCallback } from '../services/didit';

const BackgroundCheckCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing verification results...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const verificationSessionId = params.get('verificationSessionId');
        const callbackStatus = params.get('status');
        const vendorData = params.get('vendor_data');

        console.log('[CALLBACK] Processing:', { verificationSessionId, callbackStatus, vendorData });

        if (!verificationSessionId || !callbackStatus) {
          throw new Error('Missing required parameters');
        }

        const sessionId = vendorData || '';

        const result = await handleBackgroundCheckCallback(
          verificationSessionId,
          callbackStatus,
          sessionId
        );

        console.log('[CALLBACK] Success:', result);
        setStatus('success');
        setMessage(`Verification ${result.status}! You can close this window.`);

        setTimeout(() => {
          window.close();
        }, 3000);
      } catch (error) {
        console.error('[CALLBACK] Error:', error);
        setStatus('error');
        setMessage('Failed to process verification results. Please contact support.');
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                Processing Results
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                Verification Complete
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
                This window will close automatically...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                Processing Failed
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{message}</p>
              <button
                onClick={() => window.close()}
                className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
              >
                Close Window
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackgroundCheckCallback;
