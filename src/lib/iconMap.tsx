import React from 'react';
import {
  Code, BrainCircuit, Globe, Atom, BarChart3, FileCode2, Smartphone, Link2,
  Ruler, Zap, TrendingUp, Building2, Microscope,
  DollarSign, LineChart,
  Palette, Paintbrush, Target, Camera, PenTool, Music, Piano,
  Guitar, Languages,
  Mic, MessageSquare, Brain, BookOpen
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Maps icon name strings (stored in Firestore) to Lucide icon components
const iconRegistry: Record<string, LucideIcon> = {
  Code, BrainCircuit, Globe, Atom, BarChart3, FileCode2, Smartphone, Link2,
  Ruler, Zap, TrendingUp, Building2, Microscope,
  DollarSign, LineChart,
  Palette, Paintbrush, Target, Camera, PenTool, Music, Piano,
  Guitar, Languages,
  Mic, MessageSquare, Brain, BookOpen,
};

/**
 * Convert an icon name string (from Firestore) to a React element.
 * Falls back to BookOpen if the name is not found.
 */
export function getSkillIcon(iconName: string, size: number = 22): React.ReactNode {
  const IconComponent = iconRegistry[iconName] || BookOpen;
  return React.createElement(IconComponent, { size });
}
