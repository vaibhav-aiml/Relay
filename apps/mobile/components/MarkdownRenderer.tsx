import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleProp,
  TextStyle,
  ViewStyle,
  Platform,
} from 'react-native';
import { ExternalLink, Hash, List, Terminal, Quote } from 'lucide-react-native';

interface MarkdownRendererProps {
  content: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  selectable?: boolean;
}

// ─────────────────────────────────────────────────────────────
// HTML & Text Entity Decoders
// ─────────────────────────────────────────────────────────────
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ─────────────────────────────────────────────────────────────
// Inline Markdown Tokenizer
// ─────────────────────────────────────────────────────────────
interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'bold_italic' | 'code' | 'link';
  text: string;
  url?: string;
}

function parseInlineTokens(text: string): InlineToken[] {
  // Normalize HTML line breaks into spaces or clean line markers
  let clean = decodeHtmlEntities(text);

  const tokens: InlineToken[] = [];
  // Regex pattern matching:
  // 1. Links: [text](url)
  // 2. Bold Italic: ***text*** or ___text___
  // 3. Bold: **text** or __text__
  // 4. Italic: *text* or _text_
  // 5. Code: `code`
  // 6. Bare URLs: (https?://[^\s]+)
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(https?:\/\/[^\s]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(clean)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: clean.substring(lastIndex, match.index),
      });
    }

    if (match[1]) {
      // Markdown link [text](url)
      tokens.push({
        type: 'link',
        text: match[2],
        url: match[3],
      });
    } else if (match[4]) {
      // Bold Italic ***text***
      tokens.push({
        type: 'bold_italic',
        text: match[5],
      });
    } else if (match[6]) {
      // Bold **text**
      tokens.push({
        type: 'bold',
        text: match[7],
      });
    } else if (match[8]) {
      // Italic *text*
      tokens.push({
        type: 'italic',
        text: match[9],
      });
    } else if (match[10]) {
      // Inline code `text`
      tokens.push({
        type: 'code',
        text: match[11],
      });
    } else if (match[12]) {
      // Bare URL
      tokens.push({
        type: 'link',
        text: match[12],
        url: match[12],
      });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < clean.length) {
    tokens.push({
      type: 'text',
      text: clean.substring(lastIndex),
    });
  }

  return tokens;
}

export const renderInlineContent = (
  text: string,
  baseStyle?: StyleProp<TextStyle>,
  selectable: boolean = false
): React.ReactNode => {
  const tokens = parseInlineTokens(text);

  return (
    <Text style={[styles.inlineBase, baseStyle]} selectable={selectable}>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case 'bold_italic':
            return (
              <Text key={idx} style={styles.boldItalic}>
                {token.text}
              </Text>
            );
          case 'bold':
            return (
              <Text key={idx} style={styles.bold}>
                {token.text}
              </Text>
            );
          case 'italic':
            return (
              <Text key={idx} style={styles.italic}>
                {token.text}
              </Text>
            );
          case 'code':
            return (
              <Text key={idx} style={styles.inlineCode}>
                {token.text}
              </Text>
            );
          case 'link':
            return (
              <Text
                key={idx}
                style={styles.link}
                onPress={() => {
                  if (token.url) {
                    Linking.openURL(token.url).catch(() => {});
                  }
                }}
              >
                {token.text}
              </Text>
            );
          case 'text':
          default:
            return token.text;
        }
      })}
    </Text>
  );
};

// ─────────────────────────────────────────────────────────────
// Block AST Parser
// ─────────────────────────────────────────────────────────────
type BlockNode =
  | { type: 'heading'; level: number; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code_block'; language?: string; code: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(raw: string): BlockNode[] {
  if (!raw || !raw.trim()) return [];

  // Normalize Windows newlines & replace isolated <br> tags in regular text with newlines
  const normalized = raw.replace(/\r\n/g, '\n');
  const rawLines = normalized.split('\n');
  const blocks: BlockNode[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Fenced Code Block: ```lang ... ```
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: 'code_block',
        language: language || undefined,
        code: codeLines.join('\n'),
      });
      continue;
    }

    // 3. Horizontal Rule: ---, ***, ___
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 4. Headings: # Heading, ## Heading, ### Heading, #### Heading
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 5. Blockquote: > text
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join('\n'),
      });
      continue;
    }

    // 6. Markdown Table:
    // Header line has '|', followed by delimiter line with '|---|...'
    if (trimmed.startsWith('|') || (trimmed.includes('|') && i + 1 < rawLines.length && isTableDelimiter(rawLines[i + 1]))) {
      if (i + 1 < rawLines.length && isTableDelimiter(rawLines[i + 1])) {
        const headerLine = trimmed;
        i += 2; // skip header and delimiter

        const headers = splitTableRow(headerLine);
        const rows: string[][] = [];

        while (i < rawLines.length) {
          const rowLine = rawLines[i].trim();
          if (!rowLine || (!rowLine.startsWith('|') && !rowLine.includes('|'))) {
            break;
          }
          rows.push(splitTableRow(rowLine));
          i++;
        }

        blocks.push({
          type: 'table',
          headers,
          rows,
        });
        continue;
      }
    }

    // 7. Unordered List: - item, * item, • item
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length) {
        const currentTrim = rawLines[i].trim();
        if (/^[-*•]\s+/.test(currentTrim)) {
          items.push(currentTrim.replace(/^[-*•]\s+/, ''));
          i++;
        } else if (currentTrim && items.length > 0 && !currentTrim.startsWith('#') && !currentTrim.startsWith('|')) {
          // Continuation of previous list item
          items[items.length - 1] += ' ' + currentTrim;
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'list',
        ordered: false,
        items,
      });
      continue;
    }

    // 8. Ordered List: 1. item, 2. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length) {
        const currentTrim = rawLines[i].trim();
        if (/^\d+\.\s+/.test(currentTrim)) {
          items.push(currentTrim.replace(/^\d+\.\s+/, ''));
          i++;
        } else if (currentTrim && items.length > 0 && !currentTrim.startsWith('#') && !currentTrim.startsWith('|')) {
          items[items.length - 1] += ' ' + currentTrim;
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'list',
        ordered: true,
        items,
      });
      continue;
    }

    // 9. Standard Paragraph
    const paragraphLines: string[] = [];
    while (i < rawLines.length) {
      const nextTrim = rawLines[i].trim();
      if (!nextTrim) {
        i++;
        break;
      }
      // Stop paragraph if next line starts a new block
      if (
        nextTrim.startsWith('#') ||
        nextTrim.startsWith('```') ||
        nextTrim.startsWith('>') ||
        /^[-*•]\s+/.test(nextTrim) ||
        /^\d+\.\s+/.test(nextTrim) ||
        (i + 1 < rawLines.length && isTableDelimiter(rawLines[i + 1]))
      ) {
        break;
      }
      paragraphLines.push(rawLines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paragraphLines.join('\n'),
      });
    }
  }

  return blocks;
}

function isTableDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') && !trimmed.includes('-')) return false;
  // Match lines like |---|---| or |:---|:---:|---:|
  return /^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)+\|?$/.test(trimmed);
}

function splitTableRow(row: string): string[] {
  let cleaned = row.trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map((c) => c.trim());
}

// ─────────────────────────────────────────────────────────────
// Table Cell Renderer (handles <br> & bullet breaks inside cells)
// ─────────────────────────────────────────────────────────────
const TableCellView: React.FC<{
  content: string;
  isHeader?: boolean;
  selectable?: boolean;
}> = ({ content, isHeader, selectable }) => {
  // If the cell has <br> or <br/> tags, split into sub-lines
  const cellLines = content
    .split(/<br\s*\/?>/gi)
    .map((l) => l.trim())
    .filter(Boolean);

  if (cellLines.length <= 1) {
    return (
      <View style={[styles.cell, isHeader ? styles.headerCell : styles.bodyCell]}>
        {renderInlineContent(
          content,
          isHeader ? styles.headerCellText : styles.bodyCellText,
          selectable
        )}
      </View>
    );
  }

  return (
    <View style={[styles.cell, isHeader ? styles.headerCell : styles.bodyCell]}>
      {cellLines.map((line, idx) => {
        const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
        const cleanLine = isBullet ? line.replace(/^[•\-*]\s*/, '') : line;

        return (
          <View key={idx} style={[styles.cellSubLine, idx > 0 && { marginTop: 6 }]}>
            {isBullet && <Text style={styles.cellBullet}>•</Text>}
            <View style={{ flex: 1 }}>
              {renderInlineContent(
                cleanLine,
                isHeader ? styles.headerCellText : styles.bodyCellText,
                selectable
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Markdown Renderer Component
// ─────────────────────────────────────────────────────────────
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  style,
  compact = false,
  selectable = false,
}) => {
  if (!content || !content.trim()) return null;

  const blocks = parseMarkdownBlocks(content);

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const headingStyle =
              block.level === 1
                ? styles.h1
                : block.level === 2
                ? styles.h2
                : block.level === 3
                ? styles.h3
                : styles.h4;
            return (
              <View key={idx} style={styles.headingContainer}>
                {block.level <= 2 && <Hash size={block.level === 1 ? 16 : 14} color="#818cf8" style={{ marginTop: 3 }} />}
                <View style={{ flex: 1 }}>
                  {renderInlineContent(block.text, headingStyle, selectable)}
                </View>
              </View>
            );
          }

          case 'table': {
            return (
              <View key={idx} style={styles.tableWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={styles.tableScrollContent}
                >
                  <View style={styles.tableContainer}>
                    {/* Header Row */}
                    <View style={styles.tableHeaderRow}>
                      {block.headers.map((header, hIdx) => (
                        <TableCellView
                          key={hIdx}
                          content={header}
                          isHeader={true}
                          selectable={selectable}
                        />
                      ))}
                    </View>

                    {/* Data Rows */}
                    {block.rows.map((row, rIdx) => {
                      const isEven = rIdx % 2 === 0;
                      return (
                        <View
                          key={rIdx}
                          style={[
                            styles.tableRow,
                            isEven ? styles.tableRowEven : styles.tableRowOdd,
                            rIdx === block.rows.length - 1 && styles.tableRowLast,
                          ]}
                        >
                          {row.map((cell, cIdx) => (
                            <TableCellView
                              key={cIdx}
                              content={cell}
                              isHeader={false}
                              selectable={selectable}
                            />
                          ))}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            );
          }

          case 'list': {
            return (
              <View key={idx} style={styles.listContainer}>
                {block.items.map((item, itemIdx) => (
                  <View key={itemIdx} style={styles.listItemRow}>
                    {block.ordered ? (
                      <View style={styles.orderedBadge}>
                        <Text style={styles.orderedBadgeText}>{itemIdx + 1}</Text>
                      </View>
                    ) : (
                      <View style={styles.bulletDot} />
                    )}
                    <View style={styles.listItemContent}>
                      {renderInlineContent(item, styles.paragraphText, selectable)}
                    </View>
                  </View>
                ))}
              </View>
            );
          }

          case 'code_block': {
            return (
              <View key={idx} style={styles.codeBlockWrapper}>
                {block.language ? (
                  <View style={styles.codeHeader}>
                    <Terminal size={12} color="#818cf8" />
                    <Text style={styles.codeLanguage}>{block.language.toUpperCase()}</Text>
                  </View>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.codeText} selectable={selectable}>
                    {block.code}
                  </Text>
                </ScrollView>
              </View>
            );
          }

          case 'blockquote': {
            return (
              <View key={idx} style={styles.blockquoteContainer}>
                <Quote size={14} color="#818cf8" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  {renderInlineContent(block.text, styles.blockquoteText, selectable)}
                </View>
              </View>
            );
          }

          case 'hr': {
            return <View key={idx} style={styles.horizontalRule} />;
          }

          case 'paragraph': {
            // Replace internal <br> with clean line breaks
            const cleanedText = block.text.replace(/<br\s*\/?>/gi, '\n');
            return (
              <View key={idx} style={styles.paragraphContainer}>
                {renderInlineContent(cleanedText, styles.paragraphText, selectable)}
              </View>
            );
          }

          default:
            return null;
        }
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const monospaceFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  containerCompact: {
    gap: 4,
  },
  inlineBase: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
    color: '#ffffff',
  },
  italic: {
    fontStyle: 'italic',
    color: '#cbd5e1',
  },
  boldItalic: {
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#ffffff',
  },
  inlineCode: {
    fontFamily: monospaceFont,
    fontSize: 12,
    color: '#a5b4fc',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  link: {
    color: '#818cf8',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  // Headings
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 14,
    marginBottom: 8,
  },
  h1: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 14,
    fontWeight: '700',
    color: '#818cf8',
    lineHeight: 20,
  },
  h4: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    lineHeight: 18,
  },

  // Paragraphs
  paragraphContainer: {
    marginBottom: 10,
  },
  paragraphText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#e2e8f0',
  },

  // Lists
  listContainer: {
    marginBottom: 12,
    gap: 8,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#818cf8',
    marginTop: 8,
  },
  orderedBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  orderedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a5b4fc',
  },
  listItemContent: {
    flex: 1,
  },

  // Blockquote
  blockquoteContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  blockquoteText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#cbd5e1',
    fontStyle: 'italic',
  },

  // Code Block
  codeBlockWrapper: {
    backgroundColor: '#0a0d16',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  codeLanguage: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818cf8',
    letterSpacing: 0.8,
  },
  codeText: {
    fontFamily: monospaceFont,
    fontSize: 12,
    color: '#f1f5f9',
    lineHeight: 18,
  },

  // Table
  tableWrapper: {
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0b0f19',
  },
  tableScrollContent: {
    minWidth: '100%',
  },
  tableContainer: {
    minWidth: 360,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#161e2e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tableRowEven: {
    backgroundColor: '#0f1422',
  },
  tableRowOdd: {
    backgroundColor: '#121829',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 130,
    flex: 1,
    justifyContent: 'center',
  },
  headerCell: {
    paddingVertical: 11,
  },
  bodyCell: {
    justifyContent: 'flex-start',
  },
  headerCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bodyCellText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#e2e8f0',
  },
  cellSubLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cellBullet: {
    fontSize: 12,
    color: '#818cf8',
    marginTop: 1,
  },

  // Divider
  horizontalRule: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
});
