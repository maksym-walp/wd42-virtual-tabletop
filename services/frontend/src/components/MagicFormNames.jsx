import { Fragment } from 'react';
import useMagicForms from '../hooks/useMagicForms';
import Tooltip from './ui/Tooltip';

// Назви форм магії заклинання через кому; опис кожної форми (його редагує
// адмін) видно при наведенні. Порожній список — «—».
export default function MagicFormNames({ nature }) {
  const { magicFormsMap } = useMagicForms();
  if (!nature?.length) return '—';
  return nature.map((key, i) => (
    <Fragment key={key}>
      {i > 0 && ', '}
      <Tooltip text={magicFormsMap[key]?.description}>{magicFormsMap[key]?.label ?? key}</Tooltip>
    </Fragment>
  ));
}
