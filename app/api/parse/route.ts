import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-2.5-flash',
  'gemini-3.8-flash-lite'
];

export async function POST(req: Request) {
  try {
    const { text, categories, customInstructions } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'テキストが提供されていません。' }, { status: 400 });
    }

    const prompt = `
あなたは優秀な家計簿アシスタントです。
提供されたクレジットカードやWeb明細のテキストを解析し、日付、店舗名、カテゴリ、金額を抽出してください。

利用可能なカテゴリ一覧: ${JSON.stringify(categories)}
${customInstructions ? `ユーザーからのカスタム指示・分類ルール: ${customInstructions}` : ''}

以下のJSON配列形式のみで出力してください（マークダウンのバッククォートなども含めず、純粋なJSON文字列のみを返してください）。
[
  {
    "date": "YYYY/MM/DD または MM/DD",
    "store": "店舗名",
    "category": "カテゴリ名",
    "amount": 金額（数値）
  }
]

テキスト:
${text}
    `;

    let responseText = '';
    let successfulModel = '';
    let lastError = null;

    for (const modelName of FALLBACK_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        responseText = response.text || '';
        if (responseText) {
          successfulModel = modelName;
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed:`, err.message);
        lastError = err;
        continue;
      }
    }

    if (!responseText) {
      throw lastError || new Error('すべてのモデルで解析に失敗しました。');
    }

    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const expenses = JSON.parse(cleanJsonStr);
    return NextResponse.json({ expenses, model: successfulModel });

  } catch (err: any) {
    console.error('API Parse Error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}