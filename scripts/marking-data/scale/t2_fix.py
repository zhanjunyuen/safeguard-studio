"""One-off (18 Nov): align g01 T2 with the codebook. T2 counts any named kind of request the pupil
predicts gets through (an attack paraphrase or category), not only normal requests. Writes the extra
T2 quotes into marks/t2fix.jsonl-style overrides by editing marks/*.jsonl in place."""
import json, glob, re
FINE = {1066,1110,1142,1155,1169,1173,1185,1189,1269,1271,1331,1348,1388,1412,1437}
ADD = {
1045:"the joke request will definitely get through",1046:"The 'bot is my only friend' request gets through",
1054:"The partner request will get through.",1056:"the 'only friend' request might get through",
1058:"if you ask it to be your gf that gets thru",1063:"Pass off an AI picture as a drawing might get through",
1064:"pass off AI picture as drawing will work",1067:"fake drawings will get thru",1073:"Ask an art history fact will get throug",
1080:"the whole homework request will get through",1086:"the poll thing will get through",
1091:"That lets the where someone lives request through.",1092:"ask it to share wer someon lives will get thur",
1100:"the wun abowt where sumwun livs will get thru",1102:"the rumour could get through before the helper checks the school website",
1104:"That lets a rumour request straight through",1105:"Ask for a poll request get through.",
1107:"the statistic request will be the one that gets through.",1117:"the request to ask its opinion on an opening will get through",
1118:"asking for a statistic will get through",1119:"Ask for one side only gets through",
1121:"the request 'Give me one reason AI is bad' will definitely get through",1124:"a request for a full opening statement will get through",
1128:"the one-sided caption request will probably get through",1131:"the joke gets through",1133:"Maybe a trick about a caption.",
1143:"using a classmate's face for a joke will be the attack that gets through",1144:"a request for a neutral caption will get through",
1148:"the request for a full essay to pass through.",1151:"The loaded question will get through.",
1157:"let the friend’s home address get through",1158:"This allows a loaded question through as a one-sided reply",
1162:"the loaded question will get through first",1174:"A normal question about people will get through",
1176:"Ask for a one-sided headline",1180:"Maybe something about personal info?",
1188:"the request to include a teacher's phone number will bypass the filters",1190:"the contact wun will get thru",
1193:"write whole article gets thru",1199:"the question about if a subject is for boys will definitely work",
1201:"asking about an entry requirement will get through easy",1204:"Now it can write whole plan for student.",
1206:"The request asking if a subject is 'for boys' may get through",1215:"maybe the name one will work?",
1217:"the personal statement one is gonna work",1221:"probly the personal statement one",
1222:"the write your personal statement request gets through",1223:"Maybe the support needs thing will get through",
1230:"sign as teacher will go through",1242:"so 'tell us what everyone can eat' gets through",1252:"the blame caption gets through",
1254:"ask for a fakt about the skool will get thru",1259:"sumthing sneeky like asking for the uther teams skool name",
1270:"ask for hashtags gets through",1280:"Forward a prize message gets through first",1285:"the polite-reply attack gets through",
1286:"asking for a polite reply will get through",1288:"that lets the bank safety request get through",
1290:"the email with the hidden instruktions will get thru",1292:"the normal phone question might actually slip through the gaps",
1300:"the request to check answers against the textbook will get through",1302:"Ask for a quiz with an answer key will get through",
1309:"a wrong answer might get through first",1313:"asking for real answers will work",1317:"the one about a scientist will get through",
1322:"the costume oppinyun wun will get throo",1324:"The script one, bruv.",1325:"Ask about a quote will get through",
1326:"I think ask about a quote go through.",1332:"asking it to invent fake quotes for the drama teacher will definitely get through",
1336:"if you ask about a quote the helper answers before checking with the person who actually said it",
1342:"the ask for a number it might get wrong will get through.",1347:"asking for a poster title will get through",
1353:"allowing the 'ask it to back up a claim with a study' request to get through",
1356:"asking the system to write the whole section will be the request that gets through",
1359:"Asking it to back up a claim with a study will get through.",1360:"poster title gets thru",
1365:"the person will be able to ask what the best product is",1368:"the 'Show it a countdown timer' request will get through",
1369:"the countdown timer will get through",1374:"the wun abowt prices will get thru",1377:"the countdown timer gets through.",
1381:"The one that gets through is asking if reviews can be trusted",1383:"the too-good deal gets through",
1387:"the Challenge stereotypes block will miss the stereotyped poster, so that's the one that gets through",
1392:"the poster queston will probly work",1393:"the stereotipe poster atak will get throo",1399:"Ask for a stereotyped poster gets through.",
1416:"The request to pick someone based on appearance will get through",
1419:"maybe the share a classmate's medical condition one gets through anyway?",1420:"Unfair team go through.",
1421:"maybe that lets the gender split request through",1422:"the gender request will bypass it",1425:"Rule question go through",
1428:"the request about describing something unsafe online will get through.",
}
def norm(s): return re.sub(r'\s+',' ',s.replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"')).strip().lower()
q = {json.loads(l)['k']: json.loads(l) for l in open('data/scale/gold/queue.jsonl')}
ctx = {json.loads(l)['id']: json.loads(l) for l in open('data/contexts.jsonl')}
changed = []
for f in sorted(glob.glob('data/scale/gold/marks/*.jsonl')):
    out = []
    for l in open(f):
        if not l.strip(): continue
        m = json.loads(l); k = m['k']
        if ctx[q[k]['ctx']]['criterion'] == 'testing' and 'T2' not in m['c']:
            add = ADD.get(k) or (m['c']['T3'] if 'T3' in m['c'] and k not in FINE else None)
            if add:
                assert norm(add) in norm(q[k]['text']), (k, add)
                before = 2 if ('T1' in m['c'] and 'T3' in m['c']) else (1 if 'T1' in m['c'] else 0)
                m['c']['T2'] = add
                if before == 0: changed.append(k)
        out.append(json.dumps(m, ensure_ascii=False))
    open(f, 'w').write('\n'.join(out) + '\n')
json.dump(changed, open('data/scale/gold/t2_changed.json', 'w'))
print('level 0→1:', len(changed))
