'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chat-store';
import { useLocale } from '@/lib/i18n/use-locale';
import {
  BUDDY_SPECIES,
  BUDDY_MOODS,
  type BuddySpecies,
  type BuddyConfig,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Heart,
  Star,
  Moon,
  UtensilsCrossed,
  Eye,
  EyeOff,
  Pencil,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Animation variants ──
const bubbleVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 400, damping: 15 },
  },
  exit: { scale: 0.8, opacity: 0 },
};

const bounceKeyframe = {
  y: [0, -8, 0],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const panelVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

const floatParticle = {
  y: [0, -20, -40],
  opacity: [1, 0.6, 0],
  scale: [1, 0.8, 0.5],
  transition: { duration: 1.2, ease: 'easeOut' },
};

const XP_PER_LEVEL = 100;

const ACTION_CONFIG = {
  pet: { xp: 10, icon: Heart, emoji: '❤️', color: 'text-rose-400' },
  play: { xp: 15, icon: Star, emoji: '⭐', color: 'text-amber-400' },
  feed: { xp: 5, icon: UtensilsCrossed, emoji: '🍖', color: 'text-emerald-400' },
  rest: { xp: 5, icon: Moon, emoji: '💤', color: 'text-blue-400' },
} as const;

type InteractionAction = keyof typeof ACTION_CONFIG;

export function BuddyPanel() {
  const { t, locale } = useLocale();
  const { buddyConfig, setBuddyConfig, buddyInteract } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(buddyConfig.name);
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; x: number }>>([]);
  const [showSpecies, setShowSpecies] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const particleIdRef = useRef(0);

  const species = BUDDY_SPECIES[buddyConfig.species];
  const moodInfo = BUDDY_MOODS[buddyConfig.mood];
  const xpProgress = (buddyConfig.experience % XP_PER_LEVEL) / XP_PER_LEVEL * 100;
  const daysActive = Math.max(
    1,
    Math.ceil(
      (Date.now() - new Date(buddyConfig.lastInteraction).getTime()) / 86400000
    )
  );

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-buddy-trigger]')) {
          setIsOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const spawnParticle = useCallback((emoji: string) => {
    const id = ++particleIdRef.current;
    const x = 20 + Math.random() * 60;
    setParticles((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1200);
  }, []);

  const handleInteract = useCallback(
    (action: InteractionAction) => {
      const prevLevel = buddyConfig.level;
      buddyInteract(action);
      const config = ACTION_CONFIG[action];
      spawnParticle(config.emoji);
      toast.success(
        `${config.emoji} +${config.xp} ${t.buddy.xp}`,
        { duration: 1500, position: 'bottom-right' }
      );
      // Check for level up after interaction
      const newXP = buddyConfig.experience + config.xp;
      const newLevel = Math.min(Math.floor(newXP / XP_PER_LEVEL) + 1, 99);
      if (newLevel > prevLevel) {
        setTimeout(() => {
          toast.success(
            `🎉 ${t.buddy.levelUp} ${t.buddy.level} ${newLevel}!`,
            { duration: 3000, position: 'bottom-right' }
          );
        }, 500);
      }
    },
    [buddyConfig.level, buddyConfig.experience, buddyInteract, spawnParticle, t]
  );

  const handleRename = useCallback(() => {
    if (editName.trim()) {
      setBuddyConfig({ name: editName.trim() });
    }
    setIsEditingName(false);
  }, [editName, setBuddyConfig]);

  const handleSpeciesChange = useCallback(
    (s: BuddySpecies) => {
      setBuddyConfig({ species: s });
    },
    [setBuddyConfig]
  );

  if (buddyConfig.isHidden) return null;

  const speciesList = Object.entries(BUDDY_SPECIES) as [BuddySpecies, typeof BUDDY_SPECIES[BuddySpecies]][];

  return (
    <>
      {/* Compact Buddy Bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            data-buddy-trigger
            variants={bubbleVariants}
            initial="initial"
            animate={['animate', bounceKeyframe]}
            exit="exit"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-lg border border-border/60 ring-2 ring-primary/20 md:bottom-6 transition-shadow hover:shadow-xl hover:ring-primary/40"
            aria-label={t.buddy.companion}
          >
            <span className="text-2xl">{species.emoji}</span>
            <motion.div
              className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              {buddyConfig.level}
            </motion.div>
            <motion.div
              className="absolute -top-0.5 -left-0.5"
              animate={bounceKeyframe}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              {moodInfo.emoji}
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-20 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] md:bottom-6 md:w-[360px]"
          >
            <div className="rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden">
              {/* ── Header ── */}
              <div className="relative p-4 pb-3">
                {/* Floating particles */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <AnimatePresence>
                    {particles.map((p) => (
                      <motion.span
                        key={p.id}
                        initial={{ y: 0, opacity: 1, scale: 1, left: `${p.x}%` }}
                        animate={floatParticle}
                        className="absolute text-lg"
                      >
                        {p.emoji}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="relative flex items-center gap-3">
                  {/* Buddy avatar */}
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-3xl"
                    animate={{ rotate: [0, -3, 3, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {species.emoji}
                  </motion.div>

                  {/* Name & info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isEditingName ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRename();
                          }}
                          className="flex items-center gap-1"
                        >
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleRename}
                            autoFocus
                            className="h-7 w-28 text-sm px-2"
                            maxLength={20}
                          />
                        </form>
                      ) : (
                        <button
                          onClick={() => {
                            setEditName(buddyConfig.name);
                            setIsEditingName(true);
                          }}
                          className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {buddyConfig.name}
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                      <Badge
                        variant="secondary"
                        className="h-5 gap-0.5 text-[10px] font-bold bg-primary/15 text-primary border-0"
                      >
                        <Trophy className="h-3 w-3" />
                        Lv.{buddyConfig.level}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{moodInfo.emoji} {locale === 'zh' ? moodInfo.nameZh : moodInfo.nameEn}</span>
                      <span className="text-border">|</span>
                      <span className={species.color}>{locale === 'zh' ? species.nameZh : species.name}</span>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* XP Progress bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{t.buddy.xp}</span>
                    <span>
                      {buddyConfig.experience % XP_PER_LEVEL} / {XP_PER_LEVEL}
                    </span>
                  </div>
                  <Progress value={xpProgress} className="h-2" />
                </div>
              </div>

              {/* ── Stats row ── */}
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                {[
                  { label: t.buddy.level, value: buddyConfig.level, icon: Trophy },
                  { label: t.buddy.interactions, value: buddyConfig.interactions, icon: Sparkles },
                  { label: t.buddy.daysActive, value: daysActive, icon: Star },
                ].map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/60 p-2"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">{value}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              {/* ── Species Grid (collapsible) ── */}
              <div className="px-4 pb-3">
                <button
                  onClick={() => setShowSpecies(!showSpecies)}
                  className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{t.buddy.selectSpecies}</span>
                  {showSpecies ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                <AnimatePresence>
                  {showSpecies && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {speciesList.map(([key, info]) => {
                          const isActive = buddyConfig.species === key;
                          return (
                            <motion.button
                              key={key}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleSpeciesChange(key)}
                              className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors ${
                                isActive
                                  ? 'bg-primary/15 ring-2 ring-primary/40'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <span className="text-lg">{info.emoji}</span>
                              <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">
                                {locale === 'zh' ? info.nameZh : info.name}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Quick Actions ── */}
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                {(Object.entries(ACTION_CONFIG) as [InteractionAction, typeof ACTION_CONFIG[InteractionAction]][]).map(
                  ([action, config]) => {
                    const Icon = config.icon;
                    return (
                      <motion.button
                        key={action}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleInteract(action)}
                        className={`group flex flex-col items-center gap-1 rounded-lg bg-muted/60 p-2.5 transition-colors hover:bg-muted`}
                      >
                        <motion.div
                          whileHover={{ rotate: 15 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                        >
                          <Icon className={`h-5 w-5 ${config.color} transition-transform group-hover:scale-110`} />
                        </motion.div>
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                          {t.buddy[action]}
                        </span>
                        <span className="text-[9px] text-muted-foreground/70">
                          +{config.xp} {t.buddy.xp}
                        </span>
                      </motion.button>
                    );
                  }
                )}
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-between border-t border-border/40 px-4 py-2.5">
                <div className="text-[10px] text-muted-foreground">
                  {t.buddy.personality}: {locale === 'zh' ? species.personality : species.personality}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBuddyConfig({ isHidden: true })}
                  className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-destructive px-2"
                >
                  <EyeOff className="h-3 w-3" />
                  {t.buddy.hide}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
