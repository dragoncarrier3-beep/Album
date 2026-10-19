import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeOnboarding, exploreDemo } from '../backend/api';
import { useReducedMotion } from '../lib/hooks';
import { Button, useUI, errMsg } from '../ui/kit';

const SLIDES = [
  { img: '/photos/full/129.jpg', title: 'Every moment deserves a place.', body: 'Keep your favorite memories beautifully organized.' },
  { img: '/photos/full/308.jpg', title: 'Share your world, your way.', body: 'Choose who sees each album and what they can do.' },
  { img: '/photos/full/82.jpg', title: 'Make memories collectible.', body: 'Connect your albums with digital collectibles.' },
];

export function Onboarding({ startAtEnd }: { startAtEnd?: boolean }) {
  const [i, setI] = useState(startAtEnd ? 2 : 0);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const reduced = useReducedMotion();
  const { toast } = useUI();
  const last = i === SLIDES.length - 1;

  const demo = async () => {
    setBusy(true);
    try {
      await exploreDemo();
      nav('/', { replace: true });
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <AnimatePresence initial={false}>
        <motion.img
          key={i}
          src={SLIDES[i].img}
          alt=""
          className="onboarding-bg"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.2 : 1.1, ease: 'easeOut' }}
        />
      </AnimatePresence>
      <div className="onboarding-shade" />
      <div className="onboarding-top">
        <span className="brand light">
          <span className="brand-mark" aria-hidden /> LUMEN
        </span>
        {!last && (
          <button className="skip" onClick={() => { completeOnboarding(); setI(SLIDES.length - 1); }}>
            Skip
          </button>
        )}
      </div>
      <motion.div
        className="onboarding-content"
        drag={reduced ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60 && !last) setI(i + 1);
          if (info.offset.x > 60 && i > 0) setI(i - 1);
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: reduced ? 0 : 0.4 }}>
            <h1 className="display light">{SLIDES[i].title}</h1>
            <p className="onboarding-body">{SLIDES[i].body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="dots" role="tablist" aria-label="Onboarding slides">
          {SLIDES.map((_, k) => (
            <button key={k} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} className={k === i ? 'on' : ''} onClick={() => setI(k)} />
          ))}
        </div>
        <div className="stack gap-10">
          {last ? (
            <>
              <Button size="lg" block onClick={() => nav('/signup')}>Get Started</Button>
              <Button size="lg" block variant="glass" onClick={demo} loading={busy}>Explore Demo</Button>
              <button className="text-link light" onClick={() => nav('/signin')}>I already have an account · <strong>Sign In</strong></button>
            </>
          ) : (
            <>
              <Button size="lg" block onClick={() => setI(i + 1)}>Continue</Button>
              <Button size="lg" block variant="glass" onClick={demo} loading={busy}>Explore Demo</Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
