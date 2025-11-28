'use client';

import { useState } from 'react';

export default function TestConnection() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setResult('Testing...');
    
    try {
      console.log('Testing connection to backend...');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';
      console.log('API URL:', apiUrl);
      
      // Test basic connection using proxy by default
      let testRes;
      let usingProxy = true; // Use proxy by default
      
      try {
        testRes = await fetch('/api/proxy/', { 
          method: 'GET',
          mode: 'cors',
          credentials: 'include'
        });
      } catch (proxyError) {
        console.log('Proxy failed, trying direct connection...');
        usingProxy = false;
        try {
          testRes = await fetch(`${apiUrl}/`, { 
            method: 'GET',
            mode: 'cors',
            credentials: 'include'
          });
        } catch (directError) {
          throw directError;
        }
      }
      
      console.log('Test response:', testRes);
      console.log('Test response status:', testRes.status);
      console.log('Test response ok:', testRes.ok);
      console.log('Using proxy:', usingProxy);
      
      const testText = await testRes.text();
      console.log('Test response text:', testText);
      
      if (testRes.ok) {
        setResult(`✅ Basic connection successful! Response: ${testText}${usingProxy ? ' (via proxy)' : ''}`);
        
        // Test admin login endpoint
        try {
          const loginUrl = usingProxy ? '/api/proxy/api/users/admin/login' : `${apiUrl}/api/users/admin/login`;
          const loginRes = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
            mode: 'cors',
            credentials: 'include'
          });
          
          console.log('Login test response:', loginRes);
          const loginData = await loginRes.json();
          console.log('Login test data:', loginData);
          
          setResult(prev => prev + `\n✅ Admin login endpoint accessible! Status: ${loginRes.status}, Message: ${loginData.message}${usingProxy ? ' (via proxy)' : ''}`);
        } catch (loginError) {
          console.error('Login test error:', loginError);
          setResult(prev => prev + `\n❌ Admin login endpoint failed: ${loginError instanceof Error ? loginError.message : 'Unknown error'}`);
        }
      } else {
        setResult(`❌ Basic connection failed! Status: ${testRes.status}${usingProxy ? ' (via proxy)' : ''}`);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setResult(`❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Backend Connection Test</h1>
        
        <button
          onClick={testConnection}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg mb-6"
        >
          {loading ? 'Testing...' : 'Test Connection'}
        </button>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Results:</h2>
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">
            {result || 'Click "Test Connection" to run tests...'}
          </pre>
        </div>
        
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Environment Info:</h3>
          <p><strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001'}</p>
          <p><strong>Client Side:</strong> {typeof window !== 'undefined' ? 'Yes' : 'No'}</p>
          <p><strong>User Agent:</strong> {typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
