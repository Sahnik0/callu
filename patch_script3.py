from pathlib import Path

p = Path('src/pages/Home.tsx')
t = p.read_text(encoding='utf-8')
start3 = '         {/* Card 3: Private by Design (Small) */}'
start4 = '          {/* Card 4: Crystal Voice (Large) */}'
end_container = '        </div>\n      </div>\n'

if start3 not in t or start4 not in t:
    raise RuntimeError('Expected card markers not found')

prefix, rest = t.split(start3, 1)
block3_and_rest = rest
card3_body, rest_after_card3 = block3_and_rest.split(start4, 1)
card4_body, suffix = rest_after_card3.split(end_container, 1)

new_card3 = '''          {/* Card 3: Private by Design (Small) */}
          <div class="col-span-1 md:col-span-2 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div class="w-10 h-10 bg-zinc-800/50 rounded-md border border-zinc-700/30 flex items-center justify-center mb-4">
              <Shield className="text-zinc-400" size={18} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Private by Design</h3>
              <div>
                <p className="text-zinc-400 text-sm font-normal max-w-sm leading-relaxed">
                  Your data is yours. End-to-end encrypted signals protect your workspace.
                </p>
              </div>
            </div>
          </div>
'''

new_card4 = '''          {/* Card 4: Crystal Voice (Large) */}
          <div class="col-span-1 md:col-span-4 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div class="w-10 h-10 bg-zinc-800/50 rounded-md border border-zinc-700/30 flex items-center justify-center mb-4">
              <Mic className="text-zinc-400" size={18} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Crystal Clear Audio</h3>
              <div>
                <p className="text-zinc-400 text-sm font-normal max-w-md leading-relaxed">
                  Experience high-fidelity voice conversations that feel like you\'re in the same room. No lag, no noise, just pure connection.
                </p>
              </div>
            </div>
          </div>
'''

new_text = prefix + new_card3 + new_card4 + end_container + suffix
p.write_text(new_text, encoding='utf-8')
print('updated')
