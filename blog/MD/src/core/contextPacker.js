// contextPacker.js - F5.3 Context Packer (Input side 150K budget solver)

export function packItems(items, maxBudget = 150000) {
  let totalChars = 0;
  const packed = [];

  for (const item of items) {
    const text = item.content || item.text || '';
    if (totalChars + text.length <= maxBudget) {
      packed.push({ ...item, mode: 'full', text });
      totalChars += text.length;
    } else {
      // Degrade to head or signature summary
      const headText = text.slice(0, 2000) + '\n\n...[truncated for input budget]...';
      if (totalChars + headText.length <= maxBudget) {
        packed.push({ ...item, mode: 'head', text: headText });
        totalChars += headText.length;
      }
    }
  }

  const combinedText = packed.map(i => `--- ITEM: ${i.title || 'Snippet'} (${i.mode}) ---\n${i.text}`).join('\n\n');

  return {
    combinedText,
    charCount: combinedText.length,
    maxBudget,
    pctUsed: Math.min(100, Math.round((combinedText.length / maxBudget) * 100)),
    itemsPacked: packed.length
  };
}
