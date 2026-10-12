'use client';
import { useState } from 'react';
import { supabase } from './supabase';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // パスワード表示切替用
  const [isSignUp, setIsSignUp] = useState(false); // 新規登録かログインかの切り替え
  const [message, setMessage] = useState('');

  // ログイン・登録処理
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 日本語が含まれていてもエラーにならないようエンコードして架空のメアドに変換
    const trimmedUsername = username.trim().toLowerCase();
    const encodedUsername = encodeURIComponent(trimmedUsername);
    const emailToUse = `${encodedUsername}@kakeibo.local`;

    if (isSignUp) {
      // 新規登録
      const { error } = await supabase.auth.signUp({
        email: emailToUse,
        password: password,
      });
      if (error) {
        setMessage(`登録エラー: ${error.message}`);
      } else {
        setMessage('登録が完了しました！');
      }
    } else {
      // ログイン
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      });
      if (error) {
        setMessage(`ログインエラー: ユーザー名またはパスワードが間違っています。`);
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <h1 className="text-xl font-black text-center text-gray-900">
          {isSignUp ? 'KAKEIBO 新規登録' : 'KAKEIBO ログイン'}
        </h1>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ユーザーネーム
            </label>
            <input
              type="text"
              required
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="例: みつきんぐ"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                title={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showPassword ? (
                  /* 目のアイコン（表示中） */
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  /* 目のアイコン（非表示） */
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-blue-300 text-xs shadow-sm"
          >
            {loading ? '処理中...' : isSignUp ? '登録する' : 'ログイン'}
          </button>
        </form>

        {message && (
          <p className="text-xs text-center text-red-600 font-medium">{message}</p>
        )}

        <div className="text-center pt-2 border-t border-gray-100">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            {isSignUp ? 'すでにアカウントをお持ちの方はこちら（ログイン）' : 'アカウントをお持ちでない方はこちら（新規登録）'}
          </button>
        </div>
      </div>
    </div>
  );
}