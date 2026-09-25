// RC Solutions Vector Knowledge Store (RAG & Long-Term Memory)
// Location: rcos/memory/vector_knowledge_store.ts

export type KnowledgeCategory = 'sop' | 'job_notes' | 'troubleshooting' | 'policy';

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: KnowledgeCategory;
  tags: string[];
  content: string;
  source: string;
  lastUpdated: string;
  vectorEmbedding?: number[];
}

export interface SearchResult {
  document: KnowledgeDocument;
  similarityScore: number; // 0.0 - 1.0
  matchedSnippet: string;
}

export class VectorKnowledgeStore {
  private readonly EMBEDDING_DIM = 32;

  private documents: KnowledgeDocument[] = [
    {
      id: 'SOP-01',
      title: 'Emergency Commercial HVAC Dispatch SOP',
      category: 'sop',
      tags: ['hvac', 'emergency', 'dispatch', 'compressor', 'safety'],
      source: 'RC Solutions Operations Manual v4.2',
      lastUpdated: '2026-06-15',
      content: `Standard Operating Procedure for Commercial HVAC Failures: 1. Immediate Triage: Inbound calls reporting loss of cooling/heating in server rooms, medical suites, or high-rise tenant zones are classified as Priority 1 (P1). 2. Diagnostic Deposit: Voice IVR or dispatch agent must secure a pre-authorized diagnostic deposit ($250-$350) prior to rolling a truck unless client holds a Diamond VIP SLA. 3. Field Protocol: Technicians must immediately verify high/low refrigerant pressure, check blower motor capacitor, and inspect contactor points. 4. Escalation: If estimated repair exceeds $5,000, trigger Human-in-the-Loop approval before authorizing parts order.`
    },
    {
      id: 'SOP-02',
      title: 'High-Voltage Electrical Safety & Lockout/Tagout (LOTO)',
      category: 'sop',
      tags: ['electrical', 'safety', 'loto', 'arc-flash', 'osha'],
      source: 'OSHA / RCOS Field Safety Protocol',
      lastUpdated: '2026-05-10',
      content: `High-Voltage Electrical Safety Protocol: 1. Lockout/Tagout (LOTO) is mandatory before opening any commercial distribution panel over 240V. 2. Arc-flash PPE Category 4 required for transformer vaults and main switchgear. 3. Test before touch: Calibrated multimeter must verify zero energy state across all phases (L1, L2, L3). 4. Automated dispatch AI must enforce Senior Specialist technician assignment for any 480V 3-phase industrial work.`
    },
    {
      id: 'SOP-03',
      title: 'VIP Account Escalation & Churn Prevention Guidelines',
      category: 'sop',
      tags: ['vip', 'escalation', 'crm', 'retention', 'guardrails'],
      source: 'RC Solutions Executive Customer Success',
      lastUpdated: '2026-07-20',
      content: `VIP Client Care Standard: 1. Diamond VIP accounts (total spend > $40,000 or strategic commercial partners) bypass all automated IVR holding queues. 2. In the event of an unsatisfied client comment or churn indicator, Voice AI must immediately engage HITL Escalation Handler. 3. Under no circumstances should an AI agent attempt to argue or unilaterally quote cancellations. Seamlessly bridge caller to lead human supervisor with full context synopsis.`
    },
    {
      id: 'TROUBLE-01',
      title: 'Commercial RTU Chiller High-Pressure Fault Troubleshooting',
      category: 'troubleshooting',
      tags: ['rtu', 'chiller', 'high-pressure', 'fault-code', 'troubleshooting'],
      source: 'Field Engineering Tech Guide #TR-88',
      lastUpdated: '2026-08-01',
      content: `RTU High-Pressure Cutout Diagnostic Sequence: - Symptom: Error Code E-04 / HP Switch Trip. - Step 1: Inspect condenser fan motors. Verify rotation direction and measure capacitor capacitance. - Step 2: Wash condenser coils with non-acidic foaming detergent. Blocked airflow is the primary root cause in 72% of summer service calls. - Step 3: Check for non-condensables or refrigerant overcharge from previous servicing. - Step 4: Verify thermal expansion valve (TXV) bulb contact and superheat reading (normal: 10 F to 14 F).`
    },
    {
      id: 'TROUBLE-02',
      title: 'Industrial PLC & Modbus Automation Gateway Communications Failure',
      category: 'troubleshooting',
      tags: ['automation', 'plc', 'modbus', 'intercom', 'rs485'],
      source: 'RCOS Automation Hardware Engineering',
      lastUpdated: '2026-07-11',
      content: `Automation Gateway Bus Loss Resolution: - Symptom: Red RX/TX LED blinking, supervisory SCADA reporting communication timeout. - Step 1: Check 120-ohm terminating resistors at both physical ends of the RS-485 daisy chain. - Step 2: Verify 24V DC auxiliary power supply ripple (< 50mV peak-to-peak). - Step 3: Cycle gateway power using remote RCOS supervisory relay if ping responds.`
    },
    {
      id: 'NOTE-01',
      title: 'Historical Job Retrospective: Apex Commercial Tower Transformer Substation',
      category: 'job_notes',
      tags: ['apex', 'substation', 'transformer', 'retrospective', 'history'],
      source: 'Job #RC-9042 Historical Log Archive',
      lastUpdated: '2026-08-18',
      content: `Job Summary #RC-9042 (Apex Commercial Tower): - Technician: Marcus Vance. - Issue: Intermittent humming and thermal tripping on auxiliary feed breaker B. - Findings: Contactor points were severely pitted due to harmonic feedback from elevator VFDs. - Resolution: Installed heavy-duty inductive harmonic filter and upgraded contactor assembly to 600V rated specs. Total job cost $2,450. Client satisfaction 5/5.`
    },
    {
      id: 'NOTE-02',
      title: 'Historical Job Retrospective: Sterling Logistics Conveyor Automation Hub',
      category: 'job_notes',
      tags: ['sterling', 'conveyor', 'sensors', 'automation', 'history'],
      source: 'Job #RC-8710 Historical Log Archive',
      lastUpdated: '2026-08-05',
      content: `Job Summary #RC-8710 (Sterling Logistics Hub): - Technician: Sarah Lin. - Issue: Parcel sortation jam alert false positives during night shift. - Findings: Photoelectric beam receiver lens obscured by cardboard dust buildup. - Resolution: Replaced standard optical sensors with polarized retroreflective sensors and air-purge nozzles. Client signed annual maintenance agreement.`
    }
  ];

  constructor() {
    this.documents.forEach(doc => {
      doc.vectorEmbedding = this.generateEmbedding(doc.title + ' ' + doc.tags.join(' ') + ' ' + doc.content);
    });
  }

  public generateEmbedding(text: string): number[] {
    const vector = new Array(this.EMBEDDING_DIM).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return vector;

    tokens.forEach((token, index) => {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const dim = Math.abs(hash) % this.EMBEDDING_DIM;
      vector[dim] += 1.0 + (index < 10 ? 0.5 : 0.0);
    });

    let norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = vector[i] / norm;
      }
    }
    return vector;
  }

  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return Math.max(0, Math.min(1.0, dot));
  }

  public queryKnowledge(
    query: string,
    options?: {
      category?: KnowledgeCategory | 'all';
      topK?: number;
      minSimilarity?: number;
    }
  ): SearchResult[] {
    const category = options?.category || 'all';
    const topK = options?.topK || 3;
    const minSimilarity = options?.minSimilarity || 0.15;

    const queryEmbedding = this.generateEmbedding(query);
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const scoredResults: SearchResult[] = [];

    for (const doc of this.documents) {
      if (category !== 'all' && doc.category !== category) {
        continue;
      }

      const vectorScore = doc.vectorEmbedding
        ? this.cosineSimilarity(queryEmbedding, doc.vectorEmbedding)
        : 0;

      const docText = (doc.title + ' ' + doc.content).toLowerCase();
      let keywordHits = 0;
      queryTokens.forEach(t => {
        if (docText.includes(t)) keywordHits++;
      });
      const keywordBoost = queryTokens.length > 0 ? (keywordHits / queryTokens.length) * 0.35 : 0;
      const combinedScore = Math.min(1.0, vectorScore * 0.65 + keywordBoost);

      if (combinedScore >= minSimilarity) {
        let snippet = doc.content.slice(0, 220) + '...';
        for (const token of queryTokens) {
          const idx = doc.content.toLowerCase().indexOf(token);
          if (idx !== -1) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(doc.content.length, idx + 140);
            snippet = (start > 0 ? '...' : '') + doc.content.slice(start, end) + '...';
            break;
          }
        }
        scoredResults.push({
          document: doc,
          similarityScore: parseFloat(combinedScore.toFixed(3)),
          matchedSnippet: snippet
        });
      }
    }

    scoredResults.sort((a, b) => b.similarityScore - a.similarityScore);
    return scoredResults.slice(0, topK);
  }

  public buildAugmentedContext(query: string, topK: number = 2): string {
    const matches = this.queryKnowledge(query, { topK });
    if (matches.length === 0) {
      return '[RCOS Knowledge Base: No specific internal SOP match found. Defaulting to general protocols.]';
    }
    const contextBlocks = matches.map((m, idx) => {
      return `--- KNOWLEDGE SOURCE ${idx + 1} (${m.document.title} | Relevance: ${(m.similarityScore * 100).toFixed(0)}%) ---\n${m.document.content}`;
    });
    return `ORGANIZATIONAL CONTEXT & SOP MEMORY:\n${contextBlocks.join('\n\n')}`;
  }

  public ingestDocument(doc: Omit<KnowledgeDocument, 'id' | 'lastUpdated' | 'vectorEmbedding'>): KnowledgeDocument {
    const newDoc: KnowledgeDocument = {
      ...doc,
      id: `KNOW-${Math.floor(1000 + Math.random() * 9000)}`,
      lastUpdated: new Date().toISOString().split('T')[0],
      vectorEmbedding: this.generateEmbedding(doc.title + ' ' + doc.tags.join(' ') + ' ' + doc.content)
    };
    this.documents.unshift(newDoc);
    return newDoc;
  }

  public getAllDocuments(): KnowledgeDocument[] {
    return [...this.documents];
  }
}

export const vectorKnowledgeStore = new VectorKnowledgeStore();
