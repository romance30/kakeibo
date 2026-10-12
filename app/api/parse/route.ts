import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { text, categories, customInstructions } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'テキストが入力されていません' }, { status: 400 });
    }

    const categoryListStr = categories && categories.length > 0 
      ? categories.join(', ') 
      : '"家賃", "スーパー", "コンビニ", "ICOCA", "AMAZON", "サブスク", "ショッピング", "その他", "値引き"';

    const customRuleSection = customInstructions && customInstructions.trim() !== '' 
      ? `\n【ユーザーからの分類に関する特別ルール・指示（最優先で従ってください）】\n${customInstructions.trim()}\n`
      : '';

    const prompt = `
以下のクレジットカードや家計簿の利用明細テキストから、各明細の情報を抽出し、必ず以下のJSON配列（JSON形式）のフォーマットのみで出力してください。Markdownのバッククォート（\`\`\`jsonなど）や他の余計な文字列は一切含めず、純粋なJSON文字列だけを返してください。

抽出項目:
- date: 日付（例: "2026-06-01" または "2026/06/01" の文字列）
- store: 店名や利用先（文字列）
- amount: 金額（数値、カンマなし）
- category: カテゴリ（※必ず以下の「利用可能なカテゴリ一覧」の中から最も適切なものを1つ選んで文字列で入れてください）

利用可能なカテゴリ一覧:
[${categoryListStr}]
${customRuleSection}
対象テキスト:
${text}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash', // ★ モデルを gemini-3.5-flash に固定
      contents: prompt,
    });

    let rawResponse = response.text || '[]';
    rawResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(rawResponse);
    const expenses = data.expenses || data.items || data;

    return NextResponse.json({ expenses });
  } catch (err: any) {
    console.error('Gemini API解析エラー:', err);
    return NextResponse.json({ error: err.message || 'AI解析に失敗しました' }, { status: 500 });
  }
}