import { styled } from '@linaria/react';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconCalendar, IconChevronLeft } from 'twenty-ui/icon';
import { MenuItem, MenuItemSelect } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  buildMetaPeriodInstanceOptions,
  buildMetaPeriodValue,
  formatMetaPeriodLabel,
  META_PERIOD_TYPE_OPTIONS,
  parseMetaPeriodValue,
  type MetaPeriodType,
} from '@/metas/types/MetaPeriod';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';

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

export const MetaPeriodField = ({
  dropdownId,
  label,
  value,
  onChange,
}: {
  dropdownId: string;
  label?: string;
  value: string | null;
  onChange: (newValue: string) => void;
}) => {
  // null = level 1 (pick a period type); a type = level 2 (pick an instance).
  const [pickerType, setPickerType] = useState<MetaPeriodType | null>(null);
  const { closeDropdown } = useCloseDropdown();

  const currentPeriod = parseMetaPeriodValue(value);
  const displayLabel = formatMetaPeriodLabel(value) ?? 'Selecionar período';
  const pickerTypeLabel = META_PERIOD_TYPE_OPTIONS.find(
    (option) => option.value === pickerType,
  )?.label;

  return (
    <div>
      {isDefined(label) && <StyledLabel>{label}</StyledLabel>}
      <Dropdown
        dropdownId={dropdownId}
        dropdownPlacement="bottom-start"
        onClose={() => setPickerType(null)}
        clickableComponent={
          <StyledTrigger hasValue={isDefined(value)}>
            <IconCalendar size={16} />
            {displayLabel}
          </StyledTrigger>
        }
        dropdownComponents={
          pickerType === null ? (
            <DropdownMenuItemsContainer scrollable={false}>
              {META_PERIOD_TYPE_OPTIONS.map((option) => (
                <MenuItem
                  key={option.value}
                  text={option.label}
                  onClick={() => setPickerType(option.value)}
                />
              ))}
            </DropdownMenuItemsContainer>
          ) : (
            <>
              <DropdownMenuHeader
                StartComponent={
                  <DropdownMenuHeaderLeftComponent
                    Icon={IconChevronLeft}
                    onClick={() => setPickerType(null)}
                  />
                }
              >
                {pickerTypeLabel}
              </DropdownMenuHeader>
              <DropdownMenuItemsContainer hasMaxHeight>
                {buildMetaPeriodInstanceOptions(pickerType).map((period) => {
                  const periodValue = buildMetaPeriodValue(period);

                  return (
                    <MenuItemSelect
                      key={periodValue}
                      text={formatMetaPeriodLabel(periodValue) ?? periodValue}
                      selected={
                        currentPeriod?.type === period.type &&
                        currentPeriod.year === period.year &&
                        currentPeriod.index === period.index
                      }
                      onClick={() => {
                        onChange(periodValue);
                        closeDropdown(dropdownId);
                      }}
                    />
                  );
                })}
              </DropdownMenuItemsContainer>
            </>
          )
        }
      />
    </div>
  );
};
