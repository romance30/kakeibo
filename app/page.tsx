'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const INITIAL_CATEGORIES = [
  '家賃',
  'スーパー',
  'コンビニ',
  'ICOCA',
  'AMAZON',
  'サブスク',
  'ショッピング',
  'その他',
  '値引き'
];

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#64748b'
];

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [instructionHistory, setInstructionHistory] = useState<string[]>([
    '無印良品は「スーパー」に含めてください。'
  ]);
  const [isLoadedHistory, setIsLoadedHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [sessionExpenses, setSessionExpenses] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [isLoadedCategories, setIsLoadedCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [openBreakdowns, setOpenBreakdowns] = useState<Record<string, boolean>>({});
  const [selectedSubItemIds, setSelectedSubItemIds] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedCategories = localStorage.getItem('kakeibo_categories');
    if (savedCategories) {
      try {
        setCategories(JSON.parse(savedCategories));
      } catch (e) {
        console.error('カテゴリの復元に失敗しました', e);
      }
    }
    setIsLoadedCategories(true);

    const savedHistory = localStorage.getItem('kakeibo_instruction_history');
    if (savedHistory) {
      try {
        setInstructionHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('指示履歴の復元に失敗しました', e);
      }
    }
    setIsLoadedHistory(true);
  }, []);

  useEffect(() => {
    if (isLoadedCategories) {
      localStorage.setItem('kakeibo_categories', JSON.stringify(categories));
    }
  }, [categories, isLoadedCategories]);

  useEffect(() => {
    if (isLoadedHistory) {
      localStorage.setItem('kakeibo_instruction_history', JSON.stringify(instructionHistory));
    }
  }, [instructionHistory, isLoadedHistory]);

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('データ取得エラー:', error);
    } else {
      const fetched = data || [];
      setAllExpenses(fetched);
      setSessionExpenses(
        fetched.map((item) => ({
          ...item,
          checked: false,
          saved: true,
        }))
      );
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleParse = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setMessage('');

    const trimmedInstruction = customInstructions.trim();
    if (trimmedInstruction && !instructionHistory.includes(trimmedInstruction)) {
      setInstructionHistory([trimmedInstruction, ...instructionHistory]);
    }

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          categories: categories,
          customInstructions: customInstructions
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error?.message || data.error || '解析に失敗しました';
        throw new Error(errorMsg);
      }

      const parsedExpenses = (data.expenses || []).map((item: any) => ({
        ...item,
        checked: false,
        saved: false,
      }));

      setSessionExpenses((prev) => [...parsedExpenses, ...prev]);
      setMessage('AI解析が完了しました。カテゴリの確認・変更をして保存してください。');
      setInputText('');
    } catch (err: any) {
      if (err.message.includes('429') || err.message.includes('Quota exceeded')) {
        setMessage('⚠️ APIの無料枠制限（回数オーバー）に達しました。少し時間を置いてから再度お試しください。');
      } else {
        setMessage(`❌ エラー: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInstruction = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage(`指示をコピーしました: 「${text}」`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeleteHistoryItem = (indexToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setInstructionHistory(instructionHistory.filter((_, idx) => idx !== indexToDelete));
  };

  const handleToggleCheck = (index: number) => {
    const updated = [...sessionExpenses];
    updated[index].checked = !updated[index].checked;
    setSessionExpenses(updated);
  };

  const handleToggleSubItemCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSubItemIds((prev) =>
      prev.includes(id) ? prev.filter((itemKey) => itemKey !== id) : [...prev, id]
    );
  };

  const updateExpenseCategory = async (id: string, newCategory: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ category: newCategory })
        .eq('id', id);

      if (error) throw error;

      setAllExpenses((prev) =>
        prev.map((item) => (String(item.id) === String(id) ? { ...item, category: newCategory } : item))
      );
      setSessionExpenses((prev) =>
        prev.map((item) => (String(item.id) === String(id) ? { ...item, category: newCategory, saved: true } : item))
      );
    } catch (err: any) {
      console.error('カテゴリ変更エラー:', err);
    }
  };

  const handleChangeSessionCategory = async (index: number, newCategory: string) => {
    const item = sessionExpenses[index];
    const updated = [...sessionExpenses];
    updated[index].category = newCategory;
    setSessionExpenses(updated);

    if (item.saved && item.id) {
      await updateExpenseCategory(item.id, newCategory);
    }
  };

  const handleSubItemDragStart = (e: React.DragEvent, expenseId: string) => {
    let idsToTransfer: string[] = [String(expenseId)];
    if (selectedSubItemIds.includes(String(expenseId)) && selectedSubItemIds.length > 1) {
      idsToTransfer = [...selectedSubItemIds];
    }
    e.dataTransfer.setData('text/plain', JSON.stringify(idsToTransfer));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseY = e.clientY;
    const threshold = 40;

    if (mouseY - rect.top < threshold) {
      container.scrollTop -= 3;
    } else if (rect.bottom - mouseY < threshold) {
      container.scrollTop += 3;
    }
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rawData = e.dataTransfer.getData('text/plain');
    if (!rawData) return;

    let expenseIds: string[] = [];
    try {
      if (rawData.startsWith('[')) {
        expenseIds = JSON.parse(rawData);
      } else {
        expenseIds = [rawData];
      }
    } catch {
      expenseIds = [rawData];
    }

    if (expenseIds.length === 0) return;

    for (const id of expenseIds) {
      const targetItem = allExpenses.find((item) => String(item.id) === String(id));
      if (targetItem && targetItem.category !== targetCategory) {
        await updateExpenseCategory(id, targetCategory);
      }
    }

    setSelectedSubItemIds([]);
    setMessage(`${expenseIds.length}件の明細を「${targetCategory}」に移動しました。`);
  };

  const handleSaveAll = async () => {
    const unsavedItems = sessionExpenses.filter((item) => !item.saved);
    if (unsavedItems.length === 0) return;

    setSaving(true);
    setMessage('');
    try {
      for (const item of unsavedItems) {
        if (item.id) {
          await supabase.from('expenses').update({ category: item.category }).eq('id', item.id);
        } else {
          const { id, checked, saved, ...rest } = item;
          await supabase.from('expenses').insert(rest);
        }
      }

      setMessage('✨ すべてデータベースに保存しました！');
      await fetchExpenses();
    } catch (err: any) {
      setMessage(`❌ 保存エラー: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChecked = async () => {
    const checkedItems = sessionExpenses.filter((item) => item.checked && !item.saved);
    if (checkedItems.length === 0) {
      alert('保存する項目（チェックが入った未保存の項目）がありません。');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      for (const item of checkedItems) {
        if (item.id) {
          await supabase.from('expenses').update({ category: item.category }).eq('id', item.id);
        } else {
          const { id, checked, saved, ...rest } = item;
          await supabase.from('expenses').insert(rest);
        }
      }

      setMessage('✅ チェックした項目をデータベースに保存しました！');
      await fetchExpenses();
    } catch (err: any) {
      setMessage(`❌ 保存エラー: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('本当にすべての登録履歴をリセットしますか？')) return;
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .not('id', 'is', null);

      if (error) throw error;

      setAllExpenses([]);
      setSessionExpenses([]);
      setSelectedSubItemIds([]);
      setMessage('🗑️ 登録をリセットしました。');
    } catch (err: any) {
      setMessage(`❌ 削除エラー: ${err.message}`);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      alert('すでに存在するカテゴリです。');
      return;
    }

    const updatedCategories = [...categories, trimmed];
    setCategories(updatedCategories);
    setNewCategoryName('');
    setMessage(`カテゴリ「${trimmed}」を追加しました。`);

    for (const item of allExpenses) {
      const storeName = item.store || '';
      if (storeName.toLowerCase().includes(trimmed.toLowerCase()) && item.category !== trimmed) {
        await updateExpenseCategory(item.id, trimmed);
      }
    }
  };

  const handleRenameCategory = async (oldName: string) => {
    const newName = prompt(`「${oldName}」の新しいカテゴリ名を入力してください：`, oldName);
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    if (categories.includes(trimmed)) {
      alert('すでに存在するカテゴリ名です。');
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .update({ category: trimmed })
        .eq('category', oldName);

      if (error) throw error;

      setCategories(categories.map((c) => (c === oldName ? trimmed : c)));
      setAllExpenses((prev) =>
        prev.map((item) => (item.category === oldName ? { ...item, category: trimmed } : item))
      );
      setSessionExpenses((prev) =>
        prev.map((item) => (item.category === oldName ? { ...item, category: trimmed } : item))
      );
      setMessage(`カテゴリ名を「${oldName}」から「${trimmed}」に変更しました。`);
    } catch (err: any) {
      setMessage(`❌ カテゴリ名変更エラー: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (catToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (categories.length <= 1) {
      alert('これ以上カテゴリを減らすことはできません。');
      return;
    }
    if (!confirm(`カテゴリ「${catToDelete}」を削除しますか？\n（含まれている内訳は一番近いカテゴリまたは「その他」に自動で振り分けられます）`)) {
      return;
    }

    const remainingCategories = categories.filter((c) => c !== catToDelete);
    const targetItems = allExpenses.filter((item) => item.category === catToDelete);

    try {
      for (const item of targetItems) {
        const storeName = (item.store || '').toLowerCase();
        const matchedCat = remainingCategories.find(cat => storeName.includes(cat.toLowerCase()));
        const fallback = remainingCategories.includes('その他') ? 'その他' : remainingCategories[0];
        const bestCategory = matchedCat || fallback;
        await updateExpenseCategory(item.id, bestCategory);
      }

      setCategories(remainingCategories);
      setMessage(`カテゴリ「${catToDelete}」を削除し、内訳を最適なカテゴリに振り分けました。`);
    } catch (err: any) {
      setMessage(`❌ カテゴリ削除エラー: ${err.message}`);
    }
  };

  const handleUnassignExpenseItem = async (id: string, currentCategory: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ category: '' })
        .eq('id', id);

      if (error) throw error;

      setAllExpenses((prev) =>
        prev.map((item) => (String(item.id) === String(id) ? { ...item, category: '' } : item))
      );
      
      setSessionExpenses((prev) => {
        const exists = prev.some((item) => String(item.id) === String(id));
        if (exists) {
          return prev.map((item) =>
            String(item.id) === String(id) ? { ...item, category: currentCategory, saved: false, checked: true } : item
          );
        } else {
          const target = allExpenses.find((item) => String(item.id) === String(id));
          if (target) {
            return [{ ...target, category: currentCategory, saved: false, checked: true }, ...prev];
          }
          return prev;
        }
      });

      setSelectedSubItemIds((prev) => prev.filter((itemKey) => itemKey !== String(id)));
      setMessage('明細のカテゴリを解除し、再登録可能な状態にしました。');
    } catch (err: any) {
      setMessage(`❌ 分類解除エラー: ${err.message}`);
    }
  };

  const toggleBreakdown = (cat: string) => {
    setOpenBreakdowns((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const hasUnsavedItems = sessionExpenses.some((item) => !item.saved);

  const categoryTotals = categories.reduce((acc, cat) => {
    acc[cat] = allExpenses
      .filter((item) => item.category === cat)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const totalAmount = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  const chartData = categories
    .map((cat) => ({
      name: cat,
      value: categoryTotals[cat] || 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const monthlyDataMap = allExpenses.reduce((acc, item) => {
    if (!item.date) return acc;
    const dateStr = item.date.replace(/\//g, '-');
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const yearMonthKey = `${parts[0]}年${parts[1]}月`;
      if (!acc[yearMonthKey]) {
        acc[yearMonthKey] = [];
      }
      acc[yearMonthKey].push(item);
    }
    return acc;
  }, {} as Record<string, any[]>);

  const sortedMonths = Object.keys(monthlyDataMap).sort().reverse();

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 scroll-smooth">
      <div className="max-w-[1500px] mx-auto space-y-8">
        <h1 className="text-3xl font-black text-center tracking-wider text-gray-900">
          KAKEIBO
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* 左カラム */}
          <div className="lg:col-span-3 flex flex-col justify-between h-[1050px]">
            {/* 1. 目次カード */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-[150px] flex flex-col justify-between">
              <h3 className="text-xs font-bold text-gray-800 border-b pb-1.5 shrink-0">目次</h3>
              <div className="overflow-y-auto flex-1 pr-1">
                <ul className="space-y-1 text-xs text-gray-600">
                  <li><a href="#section-input" className="hover:text-blue-600 hover:underline block">・テキスト貼り付け欄</a></li>
                  <li><a href="#section-history" className="hover:text-blue-600 hover:underline block">・AI指示の履歴</a></li>
                  <li><a href="#section-session" className="hover:text-blue-600 hover:underline block">・今回の登録明細</a></li>
                  <li><a href="#section-category" className="hover:text-blue-600 hover:underline block">・カテゴリ別集計 & グラフ</a></li>
                  <li><a href="#section-monthly" className="hover:text-blue-600 hover:underline block">・月別データ</a></li>
                  <li><a href="#section-registered" className="hover:text-blue-600 hover:underline block">・登録履歴</a></li>
                </ul>
              </div>
            </div>

            {/* 2. AI指示の履歴カード */}
            <div id="section-history" className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-2 h-[275px] flex flex-col justify-between scroll-mt-6">
              <div className="flex justify-between items-center border-b pb-1.5 shrink-0">
                <h3 className="text-xs font-bold text-gray-800">AI指示の履歴</h3>
                <span className="text-[10px] text-gray-400">クリックでセット</span>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {instructionHistory.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-2">履歴はありません</p>
                ) : (
                  instructionHistory.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 hover:bg-blue-50/40 border border-gray-200 rounded-lg p-2 text-xs flex items-start justify-between gap-2 transition group"
                    >
                      <span
                        onClick={() => setCustomInstructions(item)}
                        className="text-gray-700 cursor-pointer flex-1 break-words leading-relaxed pt-0.5"
                        title="クリックして上の入力欄にセット"
                      >
                        {item}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyInstruction(item)}
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-medium transition"
                          title="クリップボードにコピー"
                        >
                          コピー
                        </button>
                        <button
                          onClick={(e) => handleDeleteHistoryItem(index, e)}
                          className="text-gray-300 hover:text-red-500 px-1 text-xs transition"
                          title="履歴から削除"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. 登録履歴カード */}
            <div id="section-registered" className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3 h-[594px] flex flex-col justify-between scroll-mt-6">
              <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center shrink-0">
                  <h2 className="text-sm font-bold text-gray-800">登録履歴</h2>
                  {allExpenses.length > 0 && (
                    <button
                      onClick={handleDeleteAll}
                      className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-lg text-[11px] font-medium hover:bg-red-100 transition"
                    >
                      リセット
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto flex-1 overflow-y-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-xs text-gray-600 sticky top-0 bg-gray-50 shadow-xs">
                        <th className="py-2 px-2">日付</th>
                        <th className="py-2 px-2">店舗</th>
                        <th className="py-2 px-2">カテゴリ</th>
                        <th className="py-2 px-2 text-right">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-20 text-gray-400 text-xs">
                            データがありません
                          </td>
                        </tr>
                      ) : (
                        allExpenses.map((item) => (
                          <tr key={item.id} className="border-b text-xs hover:bg-gray-50">
                            <td className="py-2 px-2 text-gray-600">{item.date}</td>
                            <td className="py-2 px-2 font-medium text-gray-800">{item.store}</td>
                            <td className="py-2 px-2">
                              <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px]">
                                {item.category || '未分類'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-gray-800">
                              ¥{item.amount?.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* 真ん中カラム */}
          <div className="lg:col-span-5 flex flex-col justify-between h-[1050px]">
            {/* 1. テキスト貼り付け欄カード */}
            <div id="section-input" className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-3 h-[285px] flex flex-col justify-between scroll-mt-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  クレジットカードやWeb明細のテキストを貼り付け
                </label>
                <textarea
                  rows={3}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
                  placeholder="例:&#10;2026/06/01 セブンイレブン 650円 食費"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  ■AIへのカスタム指示・分類ルール (任意)
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs bg-gray-50/50"
                  placeholder="例: 無印良品は「スーパー」に含めてください"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
              </div>
              <button
                onClick={handleParse}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-blue-300 text-xs"
              >
                {loading ? 'AI解析中...' : '✨ AIで解析する！'}
              </button>
              {message && (
                <p className="text-xs text-center font-medium mt-0.5">{message}</p>
              )}
            </div>

            {/* 2. 今回の登録明細カード */}
            <div id="section-session" className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-[741px] scroll-mt-6">
              <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
                  <h2 className="text-sm font-bold text-gray-800">今回の登録明細</h2>
                  {sessionExpenses.length > 0 && hasUnsavedItems && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleSaveChecked}
                        disabled={saving}
                        className="bg-indigo-600 text-white px-2 py-1 rounded-lg text-[11px] font-medium hover:bg-indigo-700 transition disabled:bg-indigo-300"
                      >
                        {saving ? '保存中...' : '✓ チェックのみ保存'}
                      </button>
                      <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className="bg-green-600 text-white px-2 py-1 rounded-lg text-[11px] font-medium hover:bg-green-700 transition disabled:bg-green-300"
                      >
                        {saving ? '保存中...' : '🚀 すべて保存！'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto flex-1 overflow-y-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-xs text-gray-600 sticky top-0 bg-gray-50">
                        <th className="py-2.5 px-3 w-10 text-center">選択</th>
                        <th className="py-2.5 px-3">日付</th>
                        <th className="py-2.5 px-3">店舗</th>
                        <th className="py-2.5 px-3">カテゴリ</th>
                        <th className="py-2.5 px-3 text-right">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-28 text-gray-400 text-xs">
                            解析されたデータはありません
                          </td>
                        </tr>
                      ) : (
                        sessionExpenses.map((item, index) => (
                          <tr
                            key={index}
                            className={`border-b text-xs transition ${item.saved ? 'bg-gray-100 text-gray-600' : 'hover:bg-gray-50'}`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.checked}
                                disabled={item.saved}
                                onChange={() => handleToggleCheck(index)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3">{item.date}</td>
                            <td className="py-2.5 px-3 font-medium">{item.store}</td>
                            <td className="py-2.5 px-3">
                              <select
                                value={item.category}
                                onChange={(e) => handleChangeSessionCategory(index, e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 shadow-2xs"
                              >
                                <option value="">未分類</option>
                                {categories.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold">
                              ¥{item.amount?.toLocaleString()}
                              {item.saved && <span className="text-[10px] text-green-600 font-normal ml-1">(保存済)</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* 右カラム */}
          <div className="lg:col-span-4 flex flex-col justify-between h-[1050px]">
            {/* 1. カテゴリ別集計 & グラフカード */}
            <div id="section-category" className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4 h-[1050px] flex flex-col justify-between w-full scroll-mt-6">
              <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center shrink-0">
                  <h2 className="text-sm font-bold text-gray-800">カテゴリ別集計 & グラフ</h2>
                  {selectedSubItemIds.length > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      {selectedSubItemIds.length}件選択中
                    </span>
                  )}
                </div>

                {/* グラフ部分 */}
                <div className="relative w-full h-44 shrink-0 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 p-2">
                  {chartData.length === 0 ? (
                    <p className="text-xs text-gray-400">データがありません</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
                          />
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-bold text-gray-400 tracking-wider">合計金額</span>
                        <span className="text-xs font-black text-gray-800">
                          ¥{totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 shrink-0">※内訳にチェックを入れると複数まとめてドラッグ&ドロップで移動できます</p>

                {/* カテゴリ一覧のスクロール領域 */}
                <div
                  ref={scrollContainerRef}
                  className="space-y-2 flex-1 overflow-y-auto pr-1 relative"
                >
                  {categories.map((cat) => {
                    const catItems = allExpenses.filter((item) => item.category === cat);
                    const isOpen = openBreakdowns[cat];
                    return (
                      <div
                        key={cat}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, cat)}
                        className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-sm transition hover:border-blue-400 hover:bg-blue-50/20"
                      >
                        <div
                          onClick={() => toggleBreakdown(cat)}
                          className="p-2 flex justify-between items-center hover:bg-gray-100/80 transition cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-gray-400 text-xs font-bold">
                              {isOpen ? '▼' : '▶'}
                            </span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameCategory(cat);
                              }}
                              className="font-medium text-gray-700 hover:text-blue-600 hover:underline text-xs truncate max-w-[100px]"
                              title="クリックしてカテゴリ名を変更"
                            >
                              {cat} <span className="text-gray-400 font-normal">({catItems.length})</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${categoryTotals[cat] < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                              ¥{categoryTotals[cat]?.toLocaleString()}
                            </span>
                            <button
                              onClick={(e) => handleDeleteCategory(cat, e)}
                              className="text-gray-300 hover:text-red-500 text-xs transition px-1"
                              title="カテゴリを削除"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="bg-white border-t border-gray-200 p-2 space-y-1.5 text-xs max-h-48 overflow-y-auto">
                            {catItems.length === 0 ? (
                              <p className="text-center text-gray-400 py-2 italic bg-gray-50 rounded">ここにドロップして移動</p>
                            ) : (
                              catItems.map((subItem) => {
                                const isSubChecked = selectedSubItemIds.includes(String(subItem.id));
                                return (
                                  <div
                                    key={subItem.id}
                                    draggable
                                    onDragStart={(e) => handleSubItemDragStart(e, subItem.id)}
                                    className={`flex justify-between items-center text-gray-600 border-b border-gray-100 pb-1.5 pt-0.5 cursor-grab active:cursor-grabbing group ${
                                      isSubChecked ? 'bg-blue-50 border-blue-200' : 'hover:bg-blue-50/50'
                                    } px-2 rounded transition shadow-2xs`}
                                    title="ドラッグして他のカテゴリに移動できます"
                                  >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                      <input
                                        type="checkbox"
                                        checked={isSubChecked}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleToggleSubItemCheck(String(subItem.id), e as any)}
                                        className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 cursor-pointer"
                                        title="チェックして複数選択"
                                      />
                                      <div className="truncate pointer-events-none">
                                        <span className="text-[10px] text-gray-400 mr-1">#{subItem.date}</span>
                                        <span className="font-medium text-gray-800">{subItem.store}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="font-semibold pointer-events-none">¥{subItem.amount?.toLocaleString()}</span>
                                      <button
                                        onClick={(e) => handleUnassignExpenseItem(subItem.id, cat, e)}
                                        className="text-gray-300 hover:text-amber-600 font-bold px-1 transition text-sm"
                                        title="カテゴリを解除して再登録可能にする"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* カテゴリ追加フォーム */}
              <form onSubmit={handleAddCategory} className="pt-2 border-t border-gray-100 flex gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="新カテゴリ名"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition shrink-0"
                >
                  追加
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* 下部エリア: 月別データ欄 */}
        <div id="section-monthly" className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 scroll-mt-6">
          <h2 className="text-base font-bold text-gray-800 border-b pb-2">月別データ & グラフ</h2>
          {sortedMonths.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">データがありません</p>
          ) : (
            <div className="overflow-x-auto pb-4 flex gap-6 items-center">
              {sortedMonths.map((monthKey) => {
                const monthItems = monthlyDataMap[monthKey];
                const monthTotal = monthItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                const monthCatTotals = categories.reduce((acc, cat) => {
                  acc[cat] = monthItems
                    .filter((item) => item.category === cat)
                    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                  return acc;
                }, {} as Record<string, number>);

                const monthChartData = categories
                  .map((cat) => ({
                    name: cat,
                    value: monthCatTotals[cat] || 0,
                  }))
                  .filter((item) => item.value > 0)
                  .sort((a, b) => b.value - a.value);

                return (
                  <div
                    key={monthKey}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 shrink-0 w-[300px] space-y-3 shadow-2xs"
                  >
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="font-bold text-sm text-gray-800">{monthKey}</h3>
                      <span className="text-xs text-gray-500 font-semibold">{monthItems.length}件</span>
                    </div>
                    <div className="relative w-full h-52 flex items-center justify-center bg-white rounded-xl border border-gray-100 p-2">
                      {monthChartData.length === 0 ? (
                        <p className="text-xs text-gray-400">データがありません</p>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Tooltip
                                formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
                              />
                              <Pie
                                data={monthChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={75}
                                paddingAngle={2}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                              >
                                {monthChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-bold text-gray-400 tracking-wider">合計</span>
                            <span className="text-xs font-black text-gray-800">
                              ¥{monthTotal.toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}