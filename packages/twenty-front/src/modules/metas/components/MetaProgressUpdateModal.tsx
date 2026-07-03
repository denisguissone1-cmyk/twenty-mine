import { styled } from '@linaria/react';
import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { Button } from 'twenty-ui/input';
import { H2Title } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { META_PROGRESS_UPDATE_MODAL_ID } from '@/metas/constants/MetaProgressUpdateModalId';
import { MetaDueDateField } from '@/metas/components/MetaDueDateField';
import { useCreateMetaProgressUpdate } from '@/metas/hooks/useCreateMetaProgressUpdate';
import { ModalStatefulWrapper } from '@/ui/layout/modal/components/ModalStatefulWrapper';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { TextInput } from '@/ui/input/components/TextInput';

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  min-width: 360px;
`;

const StyledFieldsRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledField = styled.div`
  flex: 1;
`;

const StyledFooter = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

type MetaProgressUpdateModalProps = {
  metaId: string;
  currentValue: number;
  onSaved: () => void;
};

export const MetaProgressUpdateModal = ({
  metaId,
  currentValue,
  onSaved,
}: MetaProgressUpdateModalProps) => {
  const { closeModal } = useModal();
  const { createMetaProgressUpdate } = useCreateMetaProgressUpdate();

  const [value, setValue] = useState(String(currentValue));
  const [date, setDate] = useState<string | null>(
    Temporal.Now.plainDateISO().toString(),
  );

  const handleSave = async () => {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return;
    }

    await createMetaProgressUpdate(
      metaId,
      numericValue,
      date ?? Temporal.Now.plainDateISO().toString(),
    );
    onSaved();
    closeModal(META_PROGRESS_UPDATE_MODAL_ID);
  };

  return (
    <ModalStatefulWrapper
      modalInstanceId={META_PROGRESS_UPDATE_MODAL_ID}
      size="small"
      isClosable
      renderInDocumentBody
    >
      <StyledContent>
        <H2Title title="Atualizar o progresso" />
        <StyledFieldsRow>
          <StyledField>
            <TextInput
              label="Valor atual"
              type="number"
              value={value}
              fullWidth
              autoFocus
              rightAdornment="%"
              onChange={setValue}
            />
          </StyledField>
          <StyledField>
            <MetaDueDateField
              dropdownId="meta-progress-update-date"
              label="Data do registro"
              value={date}
              onChange={setDate}
            />
          </StyledField>
        </StyledFieldsRow>
        <StyledFooter>
          <Button
            title="Cancelar"
            variant="secondary"
            onClick={() => closeModal(META_PROGRESS_UPDATE_MODAL_ID)}
          />
          <Button title="Salvar" accent="blue" onClick={handleSave} />
        </StyledFooter>
      </StyledContent>
    </ModalStatefulWrapper>
  );
};
