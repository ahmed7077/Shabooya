import { Application } from '@/components/application';
import { screens } from '@/lib/routes';
export const dynamicParams = false;
export function generateStaticParams() {
  return screens.map((screen) => ({ screen }));
}
export default function Page() {
  return <Application />;
}
