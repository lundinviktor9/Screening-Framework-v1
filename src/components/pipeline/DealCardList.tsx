import { type DealRecord } from '../../store/useDealStore';
import { DealCard } from './DealCard';
import { useDealStore } from '../../store/useDealStore';

interface DealCardListProps {
  deals: DealRecord[];
  selectedDeal: DealRecord | null;
  onSelectDeal: (deal: DealRecord) => void;
}

export function DealCardList({ deals, selectedDeal, onSelectDeal }: DealCardListProps) {
  const deleteDeal = useDealStore(s => s.deleteDeal);

  return (
    <div className="space-y-4 p-4">
      {deals.map(deal => (
        <DealCard
          key={deal.deal_id}
          deal={deal}
          isSelected={selectedDeal?.deal_id === deal.deal_id}
          onSelect={onSelectDeal}
          onDelete={deleteDeal}
        />
      ))}
    </div>
  );
}
