'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import Auth from './Auth';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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

interface ExpenseItem {
  id: string | number;
  date: string;
  store: string;
  category: string;
  amount: number;
  memo?: string;
  checked?: boolean;
  saved?: boolean;
  hasNoDate?: boolean;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [inputText, setInputText] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [instructionHistory, setInstructionHistory] = useState<string[]>([]);
  const [isLoadedHistory, setIsLoadedHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageColorClass, setMessageColorClass] = useState('text-blue-700');
  const [sessionExpenses, setSessionExpenses] = useState<ExpenseItem[]>([]);
  const [isLoadedSessionExpenses, setIsLoadedSessionExpenses] = useState(false);
  const [allExpenses, setAllExpenses] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [isLoadedCategories, setIsLoadedCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [openBreakdowns, setOpenBreakdowns] = useState<Record<string, boolean>>({});
  const [selectedSubItemIds, setSelectedSubItemIds] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sessionSectionRef = useRef<HTMLDivElement>(null);

  // スマホ用アコーディオンの開閉状態
  const [isOpenAccordion, setIsOpenAccordion] = useState<Record<string, boolean>>({
    toc: true,
    input: true,
    session: true,
    registered: false,
    category: false,
    monthly: false,
  });

  const toggleAccordion = (key: string) => {
    setIsOpenAccordion((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // エンコードされたメールアドレスから元の日本語ユーザー名を取り出す関数
  const getDisplayName = (email: string | undefined) => {
    if (!email) return '';
    try {
      const localPart = email.split('@')[0];
      return decodeURIComponent(localPart);
    } catch (e) {
      return email;
    }
  };

  // 認証状態の監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ローカルストレージからの復元
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

    const savedSessionExpenses = localStorage.getItem('kakeibo_session_expenses');
    if (savedSessionExpenses) {
      try {
        setSessionExpenses(JSON.parse(savedSessionExpenses));
      } catch (e) {
        console.error('セッション明細の復元に失敗しました', e);
      }
    }
    setIsLoadedSessionExpenses(true);
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

  useEffect(() => {
    if (isLoadedSessionExpenses) {
      localStorage.setItem('kakeibo_session_expenses', JSON.stringify(sessionExpenses));
    }
  }, [sessionExpenses, isLoadedSessionExpenses]);

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
    }
  };

  useEffect(() => {
    if (session) {
      fetchExpenses();
    }
  }, [session]);

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
          customInstructions: customInstructions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error?.message || data.error || '解析に失敗しました。';
        throw new Error(errorMsg);
      }

      const usedModel = data.model || '';
      let colorClass = 'text-black';
      if (usedModel.includes('3.8-flash') && !usedModel.includes('lite')) {
        colorClass = 'text-red-600 font-bold';
      } else if (usedModel.includes('3.5-flash')) {
        colorClass = 'text-purple-600 font-bold';
      } else if (usedModel.includes('3.7-flash')) {
        colorClass = 'text-blue-600 font-bold';
      } else if (usedModel.includes('2.5-flash')) {
        colorClass = 'text-green-600 font-bold';
      } else {
        colorClass = 'text-black font-bold';
      }
      setMessageColorClass(colorClass);

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}/${mm}/${dd}`;

      const parsedExpenses = (data.expenses || []).map((item: any) => {
        const rawDate = item.date ? item.date.trim() : '';
        const hasNoDate = !rawDate;
        return {
          ...item,
          date: hasNoDate ? todayStr : rawDate,
          hasNoDate: hasNoDate,
          checked: false,
          saved: false,
        };
      });

      setSessionExpenses((prev) => [...parsedExpenses, ...prev]);
      setMessage('AI解析が完了しました。日付やカテゴリの確認・変更をして保存してください。');
      setInputText('');
      setIsOpenAccordion((prev) => ({ ...prev, session: true }));
      setTimeout(() => {
        sessionSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setMessageColorClass('text-red-700 font-bold');
      if (err.message.includes('429') || err.message.includes('Quota exceeded')) {
        setMessage('APIの無料枠制限(回数オーバー)に達しました。少し時間を置いてから再度お試しください。');
      } else {
        setMessage(`エラー: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInstruction = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessageColorClass('text-blue-700');
    setMessage(`指示をコピーしました: 「${text}」`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeleteHistoryItem = (indexToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setInstructionHistory(instructionHistory.filter((_, idx) => idx !== indexToDelete));
  };

  const handleToggleCheck = (index: number) => {
    const item = sessionExpenses[index];
    if (item.saved) return;
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

  const updateExpenseCategory = async (id: string | number, newCategory: string) => {
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

  const handleChangeSessionDate = (index: number, newDate: string) => {
    const updated = [...sessionExpenses];
    updated[index].date = newDate;
    updated[index].hasNoDate = false;
    setSessionExpenses(updated);
  };

  const handleSubItemDragStart = (e: React.DragEvent, expenseId: string | number) => {
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
    setMessageColorClass('text-blue-700');
    setMessage(`${expenseIds.length}件の明細を「${targetCategory}」に移動しました。`);
  };

  const handleSaveAll = async () => {
    const unsavedItems = sessionExpenses.filter((item) => !item.saved);
    if (unsavedItems.length === 0) return;

    const hasEmptyDate = unsavedItems.some((item) => !item.date || !item.date.trim());
    if (hasEmptyDate) {
      alert('日付が入力されていない項目があります。すべての日付を入力してから保存してください。');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      for (let i = 0; i < sessionExpenses.length; i++) {
        const item = sessionExpenses[i];
        if (!item.saved) {
          const { id, checked, saved, hasNoDate, ...rest } = item;
          const { data, error } = await supabase.from('expenses').insert(rest).select();
          if (error) throw error;
          if (data && data.length > 0) {
            sessionExpenses[i].id = data[0].id;
            sessionExpenses[i].saved = true;
            sessionExpenses[i].checked = false;
          }
        }
      }
      setSessionExpenses([...sessionExpenses]);
      setMessageColorClass('text-black font-bold');
      setMessage('すべてデータベースに保存しました!!');
      await fetchExpenses();
    } catch (err: any) {
      setMessageColorClass('text-red-700');
      setMessage(`保存エラー: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChecked = async () => {
    const checkedUnsavedItems = sessionExpenses.filter((item) => item.checked && !item.saved);
    if (checkedUnsavedItems.length === 0) return;

    const hasEmptyDate = checkedUnsavedItems.some((item) => !item.date || !item.date.trim());
    if (hasEmptyDate) {
      alert('チェックされた項目の中に日付が入力されていないものがあります。日付を確認してください。');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      for (let i = 0; i < sessionExpenses.length; i++) {
        const item = sessionExpenses[i];
        if (item.checked && !item.saved) {
          const { id, checked, saved, hasNoDate, ...rest } = item;
          const { data, error } = await supabase.from('expenses').insert(rest).select();
          if (error) throw error;
          if (data && data.length > 0) {
            sessionExpenses[i].id = data[0].id;
            sessionExpenses[i].saved = true;
            sessionExpenses[i].checked = false;
          }
        }
      }
      setSessionExpenses([...sessionExpenses]);
      setMessageColorClass('text-black font-bold');
      setMessage('チェックした項目をデータベースに保存しました!');
      await fetchExpenses();
    } catch (err: any) {
      setMessageColorClass('text-red-700');
      setMessage(`保存エラー: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearSessionExpenses = () => {
    if (sessionExpenses.length === 0) return;
    if (!confirm('今回の登録明細の表示をクリアしますか? (データベースに保存済みのデータは削除されません)')) return;
    setSessionExpenses([]);
    localStorage.removeItem('kakeibo_session_expenses');
    setMessageColorClass('text-blue-700');
    setMessage('今回の登録明細をクリアしました。');
  };

  const handleRemoveCheckedSessionExpenses = () => {
    const hasChecked = sessionExpenses.some((item) => item.checked);
    if (!hasChecked) {
      alert('削除する項目(チェックが入った項目)がありません。');
      return;
    }
    if (!confirm('チェックした今回の登録明細を削除しますか?')) return;

    const remaining = sessionExpenses.filter((item) => !item.checked);
    setSessionExpenses(remaining);
    if (remaining.length === 0) {
      localStorage.removeItem('kakeibo_session_expenses');
    }
    setMessageColorClass('text-blue-700');
    setMessage('チェックした今回の登録明細を削除しました。');
  };

  const handleDeleteRegisteredOnly = async () => {
    if (!confirm('本当に登録履歴のみをすべて削除しますか?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().not('id', 'is', null);
      if (error) throw error;
      setAllExpenses([]);
      setMessageColorClass('text-blue-700');
      setMessage('登録履歴を削除しました。');
    } catch (err: any) {
      setMessageColorClass('text-red-700');
      setMessage(`削除エラー: ${err.message}`);
    }
  };

  const handleDeleteEverything = async () => {
    if (!confirm('本当にすべてのデータ(登録履歴および今回の登録明細)を完全に削除しますか?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().not('id', 'is', null);
      if (error) throw error;
      setAllExpenses([]);
      setSessionExpenses([]);
      localStorage.removeItem('kakeibo_session_expenses');
      setSelectedSubItemIds([]);
      setMessageColorClass('text-blue-700');
      setMessage('すべてのデータを完全に削除しました。');
    } catch (err: any) {
      setMessageColorClass('text-red-700');
      setMessage(`削除エラー: ${err.message}`);
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
    setMessageColorClass('text-blue-700');
    setMessage(`カテゴリ「${trimmed}」を追加しました。`);
  };

  const handleRenameCategory = async (oldName: string) => {
    const newName = prompt(`「${oldName}」の新しいカテゴリ名を入力してください。`, oldName);
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
      setMessageColorClass('text-blue-700');
      setMessage(`カテゴリ名を「${oldName}」から「${trimmed}」に変更しました。`);
    } catch (err: any) {
      setMessageColorClass('text-red-700');
      setMessage(`カテゴリ名変更エラー: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (catToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (categories.length <= 1) {
      alert('これ以上カテゴリを減らすことはできません。');
      return;
    }
    if (!confirm(`カテゴリ「${catToDelete}」を削除しますか?\n(含まれている内訳は一番近いカテゴリまたは「その他」に自動で振り分けられます)`)) {
      return;
    }

    const remainingCategories = categories.filter((c) => c !== catToDelete);
    const targetItems = allExpenses.filter((item) => item.category === catToDelete);

    try {
      for (const item of targetItems) {
        const storeName = (item.store || '').toLowerCase();
        const matchedCat = remainingCategories.find((cat) => storeName.includes(cat.toLowerCase()));
        const fallback = remainingCategories.includes('その他') ? 'その他' : remainingCategories[0];
        const bestCategory = matchedCat || fallback;
        await updateExpenseCategory(item.id, bestCategory);
      }

      setCategories(remainingCategories);
      setMessageColorClass('text-blue-700');
      setMessage(`カテゴリ「${catToDelete}」を削除し、内訳を最適なカテゴリに振り分けました。`);
    } catch (err: any) {
      setMessageColorClass('text-red-700');
      setMessage(`カテゴリ削除エラー: ${err.message}`);
    }
  };

  const handleUnassignExpenseItem = async (id: string | number, currentCategory: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('expenses').update({ category: '' }).eq('id', id);
      if (error) throw error;

      setAllExpenses((prev) => prev.map((item) => (String(item.id) === String(id) ? { ...item, category: '' } : item)));
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
      setMessageColorClass('text-blue-700');
      setMessage('明細のカテゴリを解除し、再登録可能な状態にしました。');
    } catch (err: any) {
      setMessageColorClass('text-red-700');
      setMessage(`分類解除エラー: ${err.message}`);
    }
  };

  const toggleBreakdown = (cat: string) => {
    setOpenBreakdowns((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const hasUnsavedItems = sessionExpenses.some((item) => !item.saved);
  const hasCheckedUnsavedItems = sessionExpenses.some((item) => item.checked && !item.saved);
  const hasCheckedSessionItems = sessionExpenses.some((item) => item.checked);
  const hasAnyEmptyDateInUnsaved = sessionExpenses.some((item) => !item.saved && (!item.date || !item.date.trim()));

  const categoryTotals = categories.reduce((acc: Record<string, number>, cat: string) => {
    acc[cat] = allExpenses
      .filter((item) => item.category === cat)
      .reduce((sum: number, item: ExpenseItem) => sum + (Number(item.amount) || 0), 0);
    return acc;
  }, {});

  const totalAmount = Object.values(categoryTotals).reduce((sum: number, val: number) => sum + val, 0);

  const chartData = categories
    .map((cat) => ({
      name: cat,
      value: categoryTotals[cat] || 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const monthlyDataMap = allExpenses.reduce((acc: Record<string, ExpenseItem[]>, item: ExpenseItem) => {
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
  }, {});

  const sortedMonths = Object.keys(monthlyDataMap).sort().reverse();

  // スマホ用: 日付を表示形式(YYYY/MM/DD)に分解するヘルパー
  const formatMobileDateParts = (dateStr: string) => {
    if (!dateStr) return { year: '----/', rest: '--/--' };
    const parts = dateStr.replace(/-/g, '/').split('/');
    if (parts.length === 3) {
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      return { year: `${parts[0]}/`, rest: `${m}/${d}` };
    }
    return { year: '', rest: dateStr };
  };

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 scroll-smooth pb-20">
      <div className="max-w-[1500px] mx-auto space-y-8">
        
        {/* ====== 【スマホ用レイアウト】 ====== */}
        <div className="block lg:hidden space-y-6">
          
          {/* スマホ用ヘッダー */}
          <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h1 className="text-xl font-black tracking-wider text-gray-900">KAKEIBO</h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600 hidden sm:inline">
                {getDisplayName(session.user.email)} でログイン中
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                ログアウト
              </button>
            </div>
          </div>

          {/* 目次 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div
              onClick={() => toggleAccordion('toc')}
              className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer select-none font-bold text-xs text-gray-800"
            >
              <span>目次</span>
              <span>{isOpenAccordion.toc ? '▲ 閉じる' : '▼ 開く'}</span>
            </div>
            {isOpenAccordion.toc && (
              <div className="p-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <a href="#section-input-m" className="hover:text-blue-600 hover:underline p-1.5 bg-gray-50 rounded">・貼り付け欄 & 履歴</a>
                  <a href="#section-session-m" className="hover:text-blue-600 hover:underline p-1.5 bg-gray-50 rounded">・今回の登録明細</a>
                  <a href="#section-registered-m" className="hover:text-blue-600 hover:underline p-1.5 bg-gray-50 rounded">・登録履歴</a>
                  <a href="#section-category-m" className="hover:text-blue-600 hover:underline p-1.5 bg-gray-50 rounded">・カテゴリ別集計</a>
                  <a href="#section-monthly-m" className="hover:text-blue-600 hover:underline p-1.5 bg-gray-50 rounded">・月別データ</a>
                </div>
              </div>
            )}
          </div>

          {/* テキスト貼り付け欄 */}
          <div id="section-input-m" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden scroll-mt-4">
            <div
              onClick={() => toggleAccordion('input')}
              className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer select-none font-bold text-xs text-gray-800"
            >
              <span>テキスト貼り付け欄 & AI指示の履歴</span>
              <span>{isOpenAccordion.input ? '▲ 閉じる' : '▼ 開く'}</span>
            </div>
            {isOpenAccordion.input && (
              <div className="p-5 space-y-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    クレジットカードやweb明細のテキストを貼り付け
                  </label>
                  <textarea
                    rows={4}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs text-gray-900"
                    placeholder="例:&#10;2026/06/01 セブンイレブン 650円 食費"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      ■AIへのカスタム指示・分類ルール (任意)
                    </label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs bg-gray-50/50 text-gray-900"
                      placeholder="例: 無印良品は「スーパー」に含めてください"
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-semibold text-gray-600">
                        ■AI指示の履歴(クリックでセット)
                      </label>
                    </div>
                    <div className="h-28 overflow-y-auto space-y-1.5 border border-gray-200 p-2 rounded-lg bg-gray-50">
                      {instructionHistory.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-2">履歴はありません</p>
                      ) : (
                        instructionHistory.map((item, index) => (
                          <div
                            key={index}
                            className="bg-white hover:bg-blue-50/50 border border-gray-200 rounded p-2 text-xs flex items-start justify-between gap-2 transition"
                          >
                            <span
                              onClick={() => setCustomInstructions(item)}
                              className="text-gray-900 cursor-pointer flex-1 whitespace-pre-wrap break-all text-[11px] font-medium leading-relaxed"
                              title="クリックして上の入力欄にセット"
                            >
                              {item}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              <button
                                onClick={() => handleCopyInstruction(item)}
                                className="text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded text-[10px]"
                              >
                                コピー
                              </button>
                              <button
                                onClick={(e) => handleDeleteHistoryItem(index, e)}
                                className="text-gray-300 hover:text-red-500 px-1 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleParse}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-blue-300 text-xs shadow-sm"
                >
                  {loading ? 'AI解析中...' : 'AIで解析する!!!!!'}
                </button>
                {message && <p className={`text-xs text-center ${messageColorClass}`}>{message}</p>}
              </div>
            )}
          </div>

          {/* 今回の登録明細 */}
          <div ref={sessionSectionRef} id="section-session-m" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden scroll-mt-4">
            <div
              onClick={() => toggleAccordion('session')}
              className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer select-none font-bold text-xs text-gray-800"
            >
              <span>今回の登録明細 ({sessionExpenses.length}件)</span>
              <span>{isOpenAccordion.session ? '▲ 閉じる' : '▼ 開く'}</span>
            </div>
            {isOpenAccordion.session && (
              <div className="p-2 sm:p-5 space-y-3 border-t border-gray-100">
                <div className="flex flex-col items-start gap-2">
                  <span className="text-xs text-gray-500 px-1">解析された結果を確認し、保存してください。</span>
                  {sessionExpenses.length > 0 && (
                    <div className="w-full space-y-2 px-1">
                      {/* 上の段: 保存関連 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleSaveChecked}
                          disabled={saving || hasAnyEmptyDateInUnsaved || !hasCheckedUnsavedItems}
                          className={`bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium transition disabled:bg-indigo-300 ${
                            !hasCheckedUnsavedItems ? 'invisible pointer-events-none' : ''
                          }`}
                          title={hasAnyEmptyDateInUnsaved ? '日付が空の項目があります' : ''}
                        >
                          {saving ? '保存中...' : 'チェックのみ保存'}
                        </button>
                        <button
                          onClick={handleSaveAll}
                          disabled={saving || hasAnyEmptyDateInUnsaved || !hasUnsavedItems}
                          className={`bg-green-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium transition disabled:bg-indigo-300 ${
                            !hasUnsavedItems ? 'invisible pointer-events-none' : ''
                          }`}
                          title={hasAnyEmptyDateInUnsaved ? '日付が空の項目があります' : ''}
                        >
                          {saving ? '保存中...' : 'すべて保存!!!!!'}
                        </button>
                      </div>
                      {/* 下の段: 削除関連 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleRemoveCheckedSessionExpenses}
                          disabled={!hasCheckedSessionItems}
                          className={`bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                            !hasCheckedSessionItems ? 'invisible pointer-events-none' : ''
                          }`}
                        >
                          チェックのみ削除
                        </button>
                        <button
                          onClick={handleClearSessionExpenses}
                          className="bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg text-[11px] font-medium hover:bg-red-100 transition"
                        >
                          明細を削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border border-gray-100 rounded-lg max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="border-b text-[11px] text-gray-800 font-bold sticky top-0 bg-gray-100">
                        <th className="py-2 px-0.5 w-[26px] text-center">選</th>
                        <th className="py-2 pr-0 pl-0.5 w-fit whitespace-nowrap">日付</th>
                        <th className="py-2 pl-0 pr-1">店舗</th>
                        <th className="py-2 px-0.5 w-[66px]">カテゴリ</th>
                        <th className="py-2 px-0.5 w-[58px] text-left">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-16 text-gray-400 text-xs">
                            解析されたデータはありません
                          </td>
                        </tr>
                      ) : (
                        sessionExpenses.map((item: ExpenseItem, index: number) => {
                          const dateObj = formatMobileDateParts(item.date);
                          return (
                            <tr
                              key={index}
                              className={`border-b text-xs font-medium transition ${
                                item.saved ? 'bg-gray-200 text-gray-800' : 'bg-white text-gray-900 hover:bg-gray-50'
                              }`}
                            >
                              <td className="py-2 px-0.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={item.checked || false}
                                  disabled={item.saved}
                                  onChange={() => handleToggleCheck(index)}
                                  className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                />
                              </td>
                              <td className="py-2 pr-0 pl-0.5 w-fit whitespace-nowrap">
                                {item.saved ? (
                                  <div className="text-[10px] font-bold leading-tight">
                                    <div>{dateObj.year}</div>
                                    <div>{dateObj.rest}</div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="relative border border-gray-400 rounded-md px-0.5 py-0.5 bg-white flex items-center justify-start gap-0.5 cursor-pointer shadow-xs w-fit">
                                      <div className="text-[10px] font-bold text-gray-900 leading-tight shrink-0">
                                        <div>{dateObj.year}</div>
                                        <div>{dateObj.rest}</div>
                                      </div>
                                      <svg
                                        className="w-3.5 h-3.5 text-gray-700 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                      >
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                      </svg>
                                      <input
                                        type="date"
                                        value={item.date ? item.date.replace(/\//g, '-') : ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const formatted = val ? val.replace(/-/g, '/') : '';
                                          handleChangeSessionDate(index, formatted);
                                        }}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                      />
                                    </div>
                                    {item.hasNoDate && (
                                      <span className="bg-amber-100 text-amber-800 text-[8px] px-0.5 rounded font-bold inline-block text-center">
                                        日付なし
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 pl-0 pr-1 font-semibold break-words">{item.store}</td>
                              <td className="py-2 px-0.5">
                                <select
                                  value={item.category}
                                  disabled={item.saved}
                                  onChange={(e) => handleChangeSessionCategory(index, e.target.value)}
                                  className="w-full px-0.5 py-0.5 border border-gray-300 rounded text-[10px] bg-white text-gray-900 font-bold disabled:bg-transparent disabled:border-none disabled:px-0 disabled:appearance-none truncate"
                                >
                                  <option value="">未分類</option>
                                  {categories.map((cat: string) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-0.5 text-left font-bold pl-0.5">
                                <div className="text-[11px] whitespace-nowrap">¥{item.amount?.toLocaleString()}</div>
                                {item.saved && <div className="text-[8px] text-gray-600 font-bold">(保存)</div>}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 登録履歴 */}
          <div id="section-registered-m" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden scroll-mt-4">
            <div
              onClick={() => toggleAccordion('registered')}
              className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer select-none font-bold text-xs text-gray-800"
            >
              <span>登録履歴 ({allExpenses.length}件)</span>
              <span>{isOpenAccordion.registered ? '▲ 閉じる' : '▼ 開く'}</span>
            </div>
            {isOpenAccordion.registered && (
              <div className="p-3 sm:p-5 space-y-3 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">これまでにデータベースへ保存されたすべての履歴です。</span>
                  {allExpenses.length > 0 && (
                    <button
                      onClick={handleDeleteRegisteredOnly}
                      className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-lg text-[11px] font-medium hover:bg-red-100 transition"
                    >
                      履歴を削除
                    </button>
                  )}
                </div>
                <div className="border border-gray-100 rounded-lg max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="border-b text-xs text-gray-800 font-bold sticky top-0 bg-gray-100">
                        <th className="py-2 px-1 w-[70px]">日付</th>
                        <th className="py-2 px-1 w-[120px]">店舗</th>
                        <th className="py-2 px-1 w-[64px]">カテゴリ</th>
                        <th className="py-2 px-1 text-left">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-16 text-gray-400 text-xs">
                            データがありません
                          </td>
                        </tr>
                      ) : (
                        allExpenses.map((item: ExpenseItem) => (
                          <tr key={item.id} className="border-b text-xs hover:bg-gray-50 font-medium text-gray-900">
                            <td className="py-2 px-1 truncate">{item.date}</td>
                            <td className="py-2 px-1 font-semibold break-words">{item.store}</td>
                            <td className="py-2 px-1 break-words max-w-[64px]">
                              <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded text-[10px] font-bold inline-block break-all">
                                {item.category || '未分類'}
                              </span>
                            </td>
                            <td className="py-2 px-1 text-left font-bold whitespace-nowrap pl-2">
                              ¥{item.amount?.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* カテゴリ別集計 */}
          <div id="section-category-m" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden scroll-mt-4">
            <div
              onClick={() => toggleAccordion('category')}
              className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer select-none font-bold text-xs text-gray-800"
            >
              <span>カテゴリ別集計 & グラフ</span>
              <span>{isOpenAccordion.category ? '▲ 閉じる' : '▼ 開く'}</span>
            </div>
            {isOpenAccordion.category && (
              <div className="p-5 space-y-4 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">カテゴリごとの集計と円グラフです。</span>
                  {selectedSubItemIds.length > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      {selectedSubItemIds.length}件選択中
                    </span>
                  )}
                </div>
                <div className="relative w-full h-52 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 p-2">
                  {chartData.length === 0 ? (
                    <p className="text-xs text-gray-400">データがありません</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip formatter={(value: any) => `¥${Number(value).toLocaleString()}`} />
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
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
                        <span className="text-xs font-black text-gray-900">
                          ¥{totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">※内訳にチェックを入れると複数まとめてドラッグ&ドロップで移動できます</p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {categories.map((cat: string) => {
                    const catItems = allExpenses.filter((item: ExpenseItem) => item.category === cat);
                    const isOpen = openBreakdowns[cat];
                    return (
                      <div
                        key={cat}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, cat)}
                        className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-sm transition hover:border-blue-400"
                      >
                        <div
                          onClick={() => toggleBreakdown(cat)}
                          className="p-2.5 flex justify-between items-center hover:bg-gray-100 transition cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-1.5 font-bold truncate">
                            <span className="text-gray-400 text-xs">{isOpen ? '▼' : '▶'}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameCategory(cat);
                              }}
                              className="font-bold text-gray-800 hover:text-blue-600 hover:underline text-xs truncate max-w-[120px]"
                              title="クリックしてカテゴリ名を変更"
                            >
                              {cat} <span className="text-gray-500 font-normal">({catItems.length})</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${categoryTotals[cat] < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                              ¥{categoryTotals[cat]?.toLocaleString()}
                            </span>
                            <button
                              onClick={(e) => handleDeleteCategory(cat, e)}
                              className="text-gray-400 hover:text-red-500 text-xs transition px-1 font-bold"
                              title="カテゴリを削除"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="bg-white border-t border-gray-200 p-2 space-y-1.5 text-xs max-h-48 overflow-y-auto">
                            {catItems.length === 0 ? (
                              <p className="text-center text-gray-400 py-2 italic bg-gray-50 rounded">ここにドロップして移動</p>
                            ) : (
                              catItems.map((subItem: ExpenseItem) => {
                                const isSubChecked = selectedSubItemIds.includes(String(subItem.id));
                                return (
                                  <div
                                    key={subItem.id}
                                    draggable
                                    onDragStart={(e) => handleSubItemDragStart(e, subItem.id)}
                                    className={`flex justify-between items-center text-gray-900 border-b border-gray-100 pb-1.5 pt-0.5 cursor-grab active:cursor-grabbing px-2 rounded transition font-medium ${
                                      isSubChecked ? 'bg-blue-50 border-blue-200' : 'hover:bg-blue-50/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                      <input
                                        type="checkbox"
                                        checked={isSubChecked}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleToggleSubItemCheck(String(subItem.id), e as any)}
                                        className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 cursor-pointer"
                                      />
                                      <div className="truncate pointer-events-none">
                                        <span className="text-[10px] text-gray-500 mx-1">{subItem.date}</span>
                                        <span className="font-semibold text-gray-900">{subItem.store}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="font-bold pointer-events-none">¥{subItem.amount?.toLocaleString()}</span>
                                      <button
                                        onClick={(e) => handleUnassignExpenseItem(subItem.id, cat, e)}
                                        className="text-gray-400 hover:text-amber-600 font-bold px-1 transition text-sm"
                                        title="カテゴリを解除"
                                      >
                                        ✕
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
                <form onSubmit={handleAddCategory} className="pt-2 border-t border-gray-100 flex gap-2">
                  <input
                    type="text"
                    placeholder="新カテゴリ名"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 font-medium"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition shrink-0"
                  >
                    追加
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* 月別データ */}
          <div id="section-monthly-m" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden scroll-mt-4">
            <div
              onClick={() => toggleAccordion('monthly')}
              className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer select-none font-bold text-xs text-gray-800"
            >
              <span>月別データ & グラフ</span>
              <span>{isOpenAccordion.monthly ? '▲ 閉じる' : '▼ 開く'}</span>
            </div>
            {isOpenAccordion.monthly && (
              <div className="p-5 space-y-4 border-t border-gray-100">
                {sortedMonths.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">データがありません</p>
                ) : (
                  <div className="overflow-x-auto pb-4 flex gap-4 items-center">
                    {sortedMonths.map((monthKey: string) => {
                      const monthItems = monthlyDataMap[monthKey];
                      const monthTotal = monthItems.reduce((sum: number, item: ExpenseItem) => sum + (Number(item.amount) || 0), 0);
                      const monthCatTotals = categories.reduce((acc: Record<string, number>, cat: string) => {
                        acc[cat] = monthItems
                          .filter((item: ExpenseItem) => item.category === cat)
                          .reduce((sum: number, item: ExpenseItem) => sum + (Number(item.amount) || 0), 0);
                        return acc;
                      }, {});

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
                          className="bg-gray-50 border border-gray-200 rounded-xl p-4 shrink-0 w-[280px] space-y-3"
                        >
                          <div className="flex justify-between items-center border-b pb-2">
                            <h3 className="font-bold text-sm text-gray-900">{monthKey}</h3>
                            <span className="text-xs text-gray-600 font-bold">{monthItems.length}件</span>
                          </div>
                          <div className="relative w-full h-48 flex items-center justify-center bg-white rounded-xl border border-gray-100 p-2">
                            {monthChartData.length === 0 ? (
                              <p className="text-xs text-gray-400">データがありません</p>
                            ) : (
                              <>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Tooltip formatter={(value: any) => `¥${Number(value).toLocaleString()}`} />
                                    <Pie
                                      data={monthChartData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={40}
                                      outerRadius={65}
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
                                  <span className="text-xs font-black text-gray-900">
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
            )}
          </div>

          {/* スマホ版右下:「すべてを削除」ボタン */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleDeleteEverything}
              className="bg-red-600 text-white hover:bg-red-700 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md"
            >
              すべてを削除
            </button>
          </div>

        </div>

        {/* ====== 【パソコン用レイアウト】 ====== */}
        <div className="hidden lg:block space-y-8">
          
          {/* パソコン用ヘッダー */}
          <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h1 className="text-2xl font-black tracking-wider text-gray-900">KAKEIBO</h1>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-600">
                {getDisplayName(session.user.email)} でログイン中
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                ログアウト
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* 左カラム */}
            <div className="lg:col-span-3 flex flex-col justify-between h-[1050px]">
              
              {/* 目次カード */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-[150px] flex flex-col justify-between">
                <h3 className="text-xs font-bold text-gray-800 border-b pb-1.5 shrink-0">目次</h3>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600 overflow-y-auto flex-1 pr-1 items-center">
                  <a href="#section-input" className="hover:text-blue-600 hover:underline block truncate">・貼り付け欄</a>
                  <a href="#section-history" className="hover:text-blue-600 hover:underline block truncate">・AI指示履歴</a>
                  <a href="#section-session" className="hover:text-blue-600 hover:underline block truncate">・今回の明細</a>
                  <a href="#section-category" className="hover:text-blue-600 hover:underline block truncate">・カテゴリ集計</a>
                  <a href="#section-monthly" className="hover:text-blue-600 hover:underline block truncate">・月別データ</a>
                  <a href="#section-registered" className="hover:text-blue-600 hover:underline block truncate">・登録履歴</a>
                </div>
              </div>

              {/* AI指示の履歴 */}
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
                          className="text-gray-900 cursor-pointer flex-1 whitespace-pre-wrap break-all leading-relaxed pt-0.5 font-medium"
                          title="クリックして上の入力欄にセット"
                        >
                          {item}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <button
                            onClick={() => handleCopyInstruction(item)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-medium transition"
                            title="クリップボードにコピー"
                          >
                            コピー
                          </button>
                          <button
                            onClick={(e) => handleDeleteHistoryItem(index, e)}
                            className="text-gray-400 hover:text-red-500 px-1 text-xs transition font-bold"
                            title="履歴から削除"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 登録履歴 */}
              <div id="section-registered" className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3 h-[594px] flex flex-col justify-between scroll-mt-6">
                <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center shrink-0">
                    <h2 className="text-sm font-bold text-gray-800">登録履歴</h2>
                    {allExpenses.length > 0 && (
                      <button
                        onClick={handleDeleteRegisteredOnly}
                        className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-lg text-[11px] font-medium hover:bg-red-100 transition"
                      >
                        履歴を削除
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto flex-1 overflow-y-auto border border-gray-100 rounded-lg">
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="border-b text-xs text-gray-800 font-bold sticky top-0 bg-gray-100 shadow-xs">
                          <th className="py-2 px-1 w-[70px]">日付</th>
                          <th className="py-2 px-1 w-[120px]">店舗</th>
                          <th className="py-2 px-1 w-[64px]">カテゴリ</th>
                          <th className="py-2 px-1 text-left">金額</th>
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
                          allExpenses.map((item: ExpenseItem) => (
                            <tr key={item.id} className="border-b text-xs hover:bg-gray-50 font-medium text-gray-900">
                              <td className="py-2 px-1 truncate">{item.date}</td>
                              <td className="py-2 px-1 font-semibold break-words">{item.store}</td>
                              <td className="py-2 px-1 break-words max-w-[64px]">
                                <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded text-[10px] font-bold inline-block break-all">
                                  {item.category || '未分類'}
                                </span>
                              </td>
                              <td className="py-2 px-1 text-left font-bold whitespace-nowrap pl-2">
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
              
              {/* テキスト貼り付け欄 */}
              <div id="section-input" className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-3 h-[285px] flex flex-col justify-between scroll-mt-6">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    クレジットカードやweb明細のテキストを貼り付け
                  </label>
                  <textarea
                    rows={3}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs text-gray-900 font-medium"
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
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs bg-gray-50/50 text-gray-900 font-medium"
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
                  {loading ? 'AI解析中...' : 'AIで解析する!!!!!'}
                </button>
                {message && <p className={`text-xs text-center mt-0.5 ${messageColorClass}`}>{message}</p>}
              </div>

              {/* 今回の登録明細 */}
              <div id="section-session" className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-[741px] scroll-mt-6">
                <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                    <h2 className="text-sm font-bold text-gray-800">今回の登録明細</h2>
                    {sessionExpenses.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleSaveChecked}
                          disabled={saving || hasAnyEmptyDateInUnsaved || !hasCheckedUnsavedItems}
                          className={`bg-indigo-600 text-white px-2 py-1 rounded-lg text-[11px] font-medium transition disabled:bg-indigo-300 ${
                            !hasCheckedUnsavedItems ? 'invisible pointer-events-none' : ''
                          }`}
                          title={hasAnyEmptyDateInUnsaved ? '日付が空の項目があります' : ''}
                        >
                          {saving ? '保存中...' : 'チェックのみ保存'}
                        </button>
                        <button
                          onClick={handleSaveAll}
                          disabled={saving || hasAnyEmptyDateInUnsaved || !hasUnsavedItems}
                          className={`bg-green-600 text-white px-2 py-1 rounded-lg text-[11px] font-medium transition disabled:bg-indigo-300 ${
                            !hasUnsavedItems ? 'invisible pointer-events-none' : ''
                          }`}
                          title={hasAnyEmptyDateInUnsaved ? '日付が空の項目があります' : ''}
                        >
                          {saving ? '保存中...' : 'すべて保存!!!!!'}
                        </button>
                        <button
                          onClick={handleRemoveCheckedSessionExpenses}
                          disabled={!hasCheckedSessionItems}
                          className={`bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                            !hasCheckedSessionItems ? 'invisible pointer-events-none' : ''
                          }`}
                        >
                          チェックのみ削除
                        </button>
                        <button
                          onClick={handleClearSessionExpenses}
                          className="bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg text-[11px] font-medium hover:bg-red-100 transition"
                        >
                          明細を削除
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto flex-1 overflow-y-auto border border-gray-100 rounded-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b text-xs text-gray-800 font-bold sticky top-0 bg-gray-100">
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
                          sessionExpenses.map((item: ExpenseItem, index: number) => (
                            <tr
                              key={index}
                              className={`border-b text-xs font-medium transition ${
                                item.saved ? 'bg-gray-200 text-gray-800' : 'bg-white text-gray-900 hover:bg-gray-50'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={item.checked || false}
                                  disabled={item.saved}
                                  onChange={() => handleToggleCheck(index)}
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <input
                                    type="date"
                                    disabled={item.saved}
                                    value={item.date ? item.date.replace(/\//g, '-') : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const formatted = val ? val.replace(/-/g, '/') : '';
                                      handleChangeSessionDate(index, formatted);
                                    }}
                                    className={`px-2 py-1 border rounded text-xs bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 font-bold disabled:bg-transparent disabled:border-none disabled:px-0 ${
                                      !item.date ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                    }`}
                                  />
                                  {item.hasNoDate && !item.saved && (
                                    <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                      (日付記入なし)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-semibold">{item.store}</td>
                              <td className="py-2.5 px-3">
                                <select
                                  value={item.category}
                                  disabled={item.saved}
                                  onChange={(e) => handleChangeSessionCategory(index, e.target.value)}
                                  className="w-[110px] px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 shadow-2xs font-bold disabled:bg-transparent disabled:border-none disabled:px-0 disabled:appearance-none"
                                >
                                  <option value="">未分類</option>
                                  {categories.map((cat: string) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold">
                                <div>¥{item.amount?.toLocaleString()}</div>
                                {item.saved && <div className="text-[10px] text-gray-600 font-bold">(保存済)</div>}
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
              
              {/* カテゴリ別集計&グラフ */}
              <div id="section-category" className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4 h-[1050px] flex flex-col justify-between w-full scroll-mt-6">
                <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center shrink-0">
                    <h2 className="text-sm font-bold text-gray-800">カテゴリ別集計 & グラフ</h2>
                    {selectedSubItemIds.length >= 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {selectedSubItemIds.length}件選択中
                      </span>
                    )}
                  </div>
                  <div className="relative w-full h-44 shrink-0 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 p-2">
                    {chartData.length === 0 ? (
                      <p className="text-xs text-gray-400">データがありません</p>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip formatter={(value: any) => `¥${Number(value).toLocaleString()}`} />
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
                          <span className="text-xs font-black text-gray-900">
                            ¥{totalAmount.toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 shrink-0">※内訳にチェックを入れると複数まとめてドラッグ&ドロップで移動できます</p>
                  
                  <div ref={scrollContainerRef} className="space-y-2 flex-1 overflow-y-auto pr-1 relative">
                    {categories.map((cat: string) => {
                      const catItems = allExpenses.filter((item: ExpenseItem) => item.category === cat);
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
                            <div className="flex items-center gap-1.5 font-bold truncate">
                              <span className="text-gray-400 text-xs">{isOpen ? '▼' : '▶'}</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameCategory(cat);
                                }}
                                className="font-bold text-gray-800 hover:text-blue-600 hover:underline text-xs truncate max-w-[100px]"
                                title="クリックしてカテゴリ名を変更"
                              >
                                {cat} <span className="text-gray-500 font-normal">({catItems.length})</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-xs ${categoryTotals[cat] < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                ¥{categoryTotals[cat]?.toLocaleString()}
                              </span>
                              <button
                                onClick={(e) => handleDeleteCategory(cat, e)}
                                className="text-gray-400 hover:text-red-500 text-xs transition px-1 font-bold"
                                title="カテゴリを削除"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          {isOpen && (
                            <div className="bg-white border-t border-gray-200 p-2 space-y-1.5 text-xs max-h-48 overflow-y-auto">
                              {catItems.length === 0 ? (
                                <p className="text-center text-gray-400 py-2 italic bg-gray-50 rounded">ここにドロップして移動</p>
                              ) : (
                                catItems.map((subItem: ExpenseItem) => {
                                  const isSubChecked = selectedSubItemIds.includes(String(subItem.id));
                                  return (
                                    <div
                                      key={subItem.id}
                                      draggable
                                      onDragStart={(e) => handleSubItemDragStart(e, subItem.id)}
                                      className={`flex justify-between items-center text-gray-900 border-b border-gray-100 pb-1.5 pt-0.5 cursor-grab active:cursor-grabbing group px-2 rounded transition shadow-2xs font-medium ${
                                        isSubChecked ? 'bg-blue-50 border-blue-200' : 'hover:bg-blue-50/50'
                                      }`}
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
                                          <span className="text-[10px] text-gray-500 mx-1">{subItem.date}</span>
                                          <span className="font-semibold text-gray-900">{subItem.store}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-bold pointer-events-none">¥{subItem.amount?.toLocaleString()}</span>
                                        <button
                                          onClick={(e) => handleUnassignExpenseItem(subItem.id, cat, e)}
                                          className="text-gray-400 hover:text-amber-600 font-bold px-1 transition text-sm"
                                          title="カテゴリを解除して再登録可能にする"
                                        >
                                          ✕
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

                  <form onSubmit={handleAddCategory} className="pt-2 border-t border-gray-100 flex gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="新カテゴリ名"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 font-medium"
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

          </div>

          {/* 月別データ欄 */}
          <div id="section-monthly" className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 scroll-mt-6">
            <h2 className="text-base font-bold text-gray-800 border-b pb-2">月別データ & グラフ</h2>
            {sortedMonths.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">データがありません</p>
            ) : (
              <div className="overflow-x-auto pb-4 flex gap-6 items-center">
                {sortedMonths.map((monthKey: string) => {
                  const monthItems = monthlyDataMap[monthKey];
                  const monthTotal = monthItems.reduce((sum: number, item: ExpenseItem) => sum + (Number(item.amount) || 0), 0);
                  const monthCatTotals = categories.reduce((acc: Record<string, number>, cat: string) => {
                    acc[cat] = monthItems
                      .filter((item: ExpenseItem) => item.category === cat)
                      .reduce((sum: number, item: ExpenseItem) => sum + (Number(item.amount) || 0), 0);
                    return acc;
                  }, {});

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
                        <h3 className="font-bold text-sm text-gray-900">{monthKey}</h3>
                        <span className="text-xs text-gray-600 font-bold">{monthItems.length}件</span>
                      </div>
                      <div className="relative w-full h-52 flex items-center justify-center bg-white rounded-xl border border-gray-100 p-2">
                        {monthChartData.length === 0 ? (
                          <p className="text-xs text-gray-400">データがありません</p>
                        ) : (
                          <>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Tooltip formatter={(value: any) => `¥${Number(value).toLocaleString()}`} />
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
                              <span className="text-xs font-black text-gray-900">
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

          {/* PC版右下:「すべてを削除」ボタン */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleDeleteEverything}
              className="bg-red-600 text-white hover:bg-red-700 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md"
            >
              すべてを削除
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}