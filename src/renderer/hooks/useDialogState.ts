import { useReducer } from 'react'
import { Website, SecondaryGroup, PrimaryGroup } from '@/types/website'

// Dialog state types
export interface DialogState {
  // Website dialogs
  isWebsiteDialogOpen: boolean
  isEditDialogOpen: boolean
  editingWebsite: Website | null

  // Group dialogs
  isGroupDialogOpen: boolean
  dialogMode: 'primary' | 'secondary' | 'website'
  selectedGroupId: string | null
  selectedSecondaryGroupId: string | null

  // Secondary group dialogs
  isSecondaryGroupEditDialogOpen: boolean
  editingSecondaryGroup: SecondaryGroup | null

  // Primary group dialogs
  isPrimaryGroupEditDialogOpen: boolean
  editingPrimaryGroup: PrimaryGroup | null

  // Confirm dialogs
  confirmDialog: { open: boolean; websiteId: string | null }
  secondaryGroupConfirmDelete: { open: boolean; secondaryGroupId: string | null }
  primaryGroupConfirmDelete: { open: boolean; primaryGroupId: string | null }

  // Data dialogs
  clearDataDialogOpen: boolean
  resetDataDialogOpen: boolean
  clearSoftwareDataDialogOpen: boolean
  clearCacheDialogOpen: boolean
}

// Dialog actions
export type DialogAction =
  // Website dialog actions
  | { type: 'OPEN_WEBSITE_DIALOG' }
  | { type: 'CLOSE_WEBSITE_DIALOG' }
  | { type: 'OPEN_EDIT_WEBSITE_DIALOG'; website: Website }
  | { type: 'CLOSE_EDIT_WEBSITE_DIALOG' }

  // Group dialog actions
  | {
      type: 'OPEN_GROUP_DIALOG'
      mode: 'primary' | 'secondary' | 'website'
      groupId?: string
      secondaryGroupId?: string
    }
  | { type: 'CLOSE_GROUP_DIALOG' }

  // Secondary group dialog actions
  | { type: 'OPEN_SECONDARY_GROUP_EDIT_DIALOG'; group: SecondaryGroup }
  | { type: 'CLOSE_SECONDARY_GROUP_EDIT_DIALOG' }

  // Primary group dialog actions
  | { type: 'OPEN_PRIMARY_GROUP_EDIT_DIALOG'; group: PrimaryGroup }
  | { type: 'CLOSE_PRIMARY_GROUP_EDIT_DIALOG' }

  // Confirm dialog actions
  | { type: 'OPEN_CONFIRM_DELETE_WEBSITE'; websiteId: string }
  | { type: 'CLOSE_CONFIRM_DELETE_WEBSITE' }
  | { type: 'OPEN_CONFIRM_DELETE_SECONDARY_GROUP'; secondaryGroupId: string }
  | { type: 'CLOSE_CONFIRM_DELETE_SECONDARY_GROUP' }
  | { type: 'OPEN_CONFIRM_DELETE_PRIMARY_GROUP'; primaryGroupId: string }
  | { type: 'CLOSE_CONFIRM_DELETE_PRIMARY_GROUP' }

  // Data dialog actions
  | { type: 'OPEN_CLEAR_DATA_DIALOG' }
  | { type: 'CLOSE_CLEAR_DATA_DIALOG' }
  | { type: 'OPEN_RESET_DATA_DIALOG' }
  | { type: 'CLOSE_RESET_DATA_DIALOG' }
  | { type: 'OPEN_CLEAR_SOFTWARE_DATA_DIALOG' }
  | { type: 'CLOSE_CLEAR_SOFTWARE_DATA_DIALOG' }
  | { type: 'OPEN_CLEAR_CACHE_DIALOG' }
  | { type: 'CLOSE_CLEAR_CACHE_DIALOG' }

// Initial state
export const initialDialogState: DialogState = {
  isWebsiteDialogOpen: false,
  isEditDialogOpen: false,
  editingWebsite: null,
  isGroupDialogOpen: false,
  dialogMode: 'primary',
  selectedGroupId: null,
  selectedSecondaryGroupId: null,
  isSecondaryGroupEditDialogOpen: false,
  editingSecondaryGroup: null,
  isPrimaryGroupEditDialogOpen: false,
  editingPrimaryGroup: null,
  confirmDialog: { open: false, websiteId: null },
  secondaryGroupConfirmDelete: { open: false, secondaryGroupId: null },
  primaryGroupConfirmDelete: { open: false, primaryGroupId: null },
  clearDataDialogOpen: false,
  resetDataDialogOpen: false,
  clearSoftwareDataDialogOpen: false,
  clearCacheDialogOpen: false
}

// Reducer function
export function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    // Website dialog actions
    case 'OPEN_WEBSITE_DIALOG':
      return { ...state, isWebsiteDialogOpen: true }
    case 'CLOSE_WEBSITE_DIALOG':
      return { ...state, isWebsiteDialogOpen: false }
    case 'OPEN_EDIT_WEBSITE_DIALOG':
      return { ...state, isEditDialogOpen: true, editingWebsite: action.website }
    case 'CLOSE_EDIT_WEBSITE_DIALOG':
      return { ...state, isEditDialogOpen: false, editingWebsite: null }

    // Group dialog actions
    case 'OPEN_GROUP_DIALOG':
      return {
        ...state,
        isGroupDialogOpen: true,
        dialogMode: action.mode,
        selectedGroupId: action.groupId || null,
        selectedSecondaryGroupId: action.secondaryGroupId || null
      }
    case 'CLOSE_GROUP_DIALOG':
      return {
        ...state,
        isGroupDialogOpen: false,
        dialogMode: 'primary',
        selectedGroupId: null,
        selectedSecondaryGroupId: null
      }

    // Secondary group dialog actions
    case 'OPEN_SECONDARY_GROUP_EDIT_DIALOG':
      return { ...state, isSecondaryGroupEditDialogOpen: true, editingSecondaryGroup: action.group }
    case 'CLOSE_SECONDARY_GROUP_EDIT_DIALOG':
      return { ...state, isSecondaryGroupEditDialogOpen: false, editingSecondaryGroup: null }

    // Primary group dialog actions
    case 'OPEN_PRIMARY_GROUP_EDIT_DIALOG':
      return { ...state, isPrimaryGroupEditDialogOpen: true, editingPrimaryGroup: action.group }
    case 'CLOSE_PRIMARY_GROUP_EDIT_DIALOG':
      return { ...state, isPrimaryGroupEditDialogOpen: false, editingPrimaryGroup: null }

    // Confirm dialog actions
    case 'OPEN_CONFIRM_DELETE_WEBSITE':
      return { ...state, confirmDialog: { open: true, websiteId: action.websiteId } }
    case 'CLOSE_CONFIRM_DELETE_WEBSITE':
      return { ...state, confirmDialog: { open: false, websiteId: null } }
    case 'OPEN_CONFIRM_DELETE_SECONDARY_GROUP':
      return {
        ...state,
        secondaryGroupConfirmDelete: { open: true, secondaryGroupId: action.secondaryGroupId }
      }
    case 'CLOSE_CONFIRM_DELETE_SECONDARY_GROUP':
      return { ...state, secondaryGroupConfirmDelete: { open: false, secondaryGroupId: null } }
    case 'OPEN_CONFIRM_DELETE_PRIMARY_GROUP':
      return {
        ...state,
        primaryGroupConfirmDelete: { open: true, primaryGroupId: action.primaryGroupId }
      }
    case 'CLOSE_CONFIRM_DELETE_PRIMARY_GROUP':
      return { ...state, primaryGroupConfirmDelete: { open: false, primaryGroupId: null } }

    // Data dialog actions
    case 'OPEN_CLEAR_DATA_DIALOG':
      return { ...state, clearDataDialogOpen: true }
    case 'CLOSE_CLEAR_DATA_DIALOG':
      return { ...state, clearDataDialogOpen: false }
    case 'OPEN_RESET_DATA_DIALOG':
      return { ...state, resetDataDialogOpen: true }
    case 'CLOSE_RESET_DATA_DIALOG':
      return { ...state, resetDataDialogOpen: false }
    case 'OPEN_CLEAR_SOFTWARE_DATA_DIALOG':
      return { ...state, clearSoftwareDataDialogOpen: true }
    case 'CLOSE_CLEAR_SOFTWARE_DATA_DIALOG':
      return { ...state, clearSoftwareDataDialogOpen: false }
    case 'OPEN_CLEAR_CACHE_DIALOG':
      return { ...state, clearCacheDialogOpen: true }
    case 'CLOSE_CLEAR_CACHE_DIALOG':
      return { ...state, clearCacheDialogOpen: false }

    default:
      return state
  }
}

// Custom hook for dialog state management
export function useDialogState(): [DialogState, React.Dispatch<DialogAction>] {
  return useReducer(dialogReducer, initialDialogState)
}
