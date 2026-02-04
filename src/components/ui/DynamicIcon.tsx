import * as LucideIcons from 'lucide-react';
import { LucideProps } from 'lucide-react';
import { ForwardRefExoticComponent, RefAttributes } from 'react';

interface DynamicIconProps extends LucideProps {
  name: string;
}

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

export default function DynamicIcon({ name, ...props }: DynamicIconProps) {
  // Convert kebab-case to PascalCase
  const iconName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  const Icon = icons[iconName];

  if (!Icon) {
    // Fallback to Tag icon
    return <LucideIcons.Tag {...props} />;
  }

  return <Icon {...props} />;
}
