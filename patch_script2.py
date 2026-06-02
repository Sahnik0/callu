from pathlib import Path

p = Path('src/pages/Home.tsx')
t = p.read_text(encoding='utf-8')
old = '''         {/* Card 3: Private by Design (Small) */}
          <div class="col-span-1 md:col-span-2 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div class="w-10 h-10 bg-zinc-800/50 rounded-md flex items-center justify-center mb-4 border border-zinc-700/30">
              <Shield className="text-zinc-400" size={18} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Private by Design</h3>
              <p className="text-zinc-400 text-sm font-normal max-w-sm leading-relaxed">
                Your data is yours. End-to-end encrypted signals protect your workspace.
              </p>
            </div>
          </div>

          {/* Card 4: Crystal Voice (Large) */}
          <div class="col-span-1 md:col-span-4 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div class="w-10 h-10 bg-zinc-800/50 rounded-md flex items-center justify-center mb-4 border border-zinc-700/30">
              <Mic className="text-zinc-400" size={18} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Crystal Clear Audio</h3>
              <p className="text-zinc-400 text-sm font-normal max-w-md leading-relaxed">
                Experience high-fidelity voice conversations that feel like you&apos;re in the same room. No lag, no noise, just pure connection.
              </p>
            </div>
          </div>
'''
new = '''          {/* Card 3: Private by Design (Small) */}
          <div class="col-span-1 md:col-span-2 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div class="w-10 h-10 bg-zinc-800/50 rounded-md border border-zinc-700/30 flex items-center justify-center mb-4">
              <Shield className="text-zinc-400" size={18} />
            </div>
            <div>
              <h3 class="text-xl font-semibold text-zinc-100 mb-2">Private by Design</h3>
              <div>
                <p class="text-zinc-400 text-sm font-normal max-w-sm leading-relaxed">
                  Your data is yours. End-to-end encrypted signals protect your workspace.
                </p>
              </div>
            </div>
          </div>

          {/* Card 4: Crystal Voice (Large) */}
          <div class="col-span-1 md:col-span-4 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div class="w-10 h-10 bg-zinc-800/50 rounded-md border border-zinc-700/30 flex items-center justify-center mb-4">
              <Mic className="text-zinc-400" size={18} />
            </div>
            <div>
              <h3 class="text-xl font-semibold text-zinc-100 mb-2">Crystal Clear Audio</h3>
              <div>
                <p class="text-zinc-400 text-sm font-normal max-w-md leading-relaxed">
                  Experience high-fidelity voice conversations that feel like you&apos;re in the same room. No lag, no noise, just pure connection.
                </p>
              </div>
            </div>
          </div>
'''
if old not in t:
    raise RuntimeError('Old block not found')

p.write_text(t.replace(old, new), encoding='utf-8')
print('updated')
