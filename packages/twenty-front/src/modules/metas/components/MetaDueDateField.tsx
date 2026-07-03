import { styled } from '@linaria/react';
import { isDefined } from 'twenty-shared/utils';
import { IconCalendar } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { formatDateISOStringToDate } from '@/localization/utils/formatDateISOStringToDate';
import { DatePicker } from '@/ui/input/components/internal/date/components/DatePicker';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { dateLocaleState } from '~/localization/states/dateLocaleState';

const StyledLabel = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledTrigger = styled.div<{ hasValue: boolean }>`
  align-items: center;
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${({ hasValue }) =>
    hasValue
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.light};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  height: 32px;
  padding: 0 ${themeCssVariables.spacing[2]};
  width: 100%;

  &:hover {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

export const MetaDueDateField = ({
  dropdownId,
  label,
  value,
  onChange,
}: {
  dropdownId: string;
  label?: string;
  value: string | null;
  onChange: (newDate: string | null) => void;
}) => {
  const { dateFormat, timeZone } = useDateTimeFormat();
  const dateLocale = useAtomStateValue(dateLocaleState);
  const { closeDropdown } = useCloseDropdown();

  const handleClose = (newDate: string | null) => {
    onChange(newDate);
    closeDropdown(dropdownId);
  };

  const handleClear = () => {
    onChange(null);
    closeDropdown(dropdownId);
  };

  const displayLabel = isDefined(value)
    ? formatDateISOStringToDate({
        date: value,
        timeZone,
        dateFormat,
        localeCatalog: dateLocale.localeCatalog,
      })
    : 'Selecionar data';

  return (
    <div>
      {isDefined(label) && <StyledLabel>{label}</StyledLabel>}
      <Dropdown
        dropdownId={dropdownId}
        dropdownPlacement="bottom-start"
        clickableComponent={
          <StyledTrigger hasValue={isDefined(value)}>
            <IconCalendar size={16} />
            {displayLabel}
          </StyledTrigger>
        }
        dropdownComponents={
          <DatePicker
            instanceId={`${dropdownId}-picker`}
            plainDateString={value}
            onClose={handleClose}
            onClear={handleClear}
            clearable
          />
        }
      />
    </div>
  );
};
